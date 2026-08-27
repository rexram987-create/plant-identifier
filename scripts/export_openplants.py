from pathlib import Path
import json
import shutil
import numpy as np
import onnxruntime as ort
from onnxruntime.quantization import (
    CalibrationDataReader,
    CalibrationMethod,
    QuantFormat,
    QuantType,
    quant_pre_process,
    quantize_static,
)
from transformers import AutoConfig

MODEL_ID = "domai-tb/OpenPlants-Identification-ViT-Base-Patch16-224"
OUT = Path("openplants-onnx")
FP32 = OUT / "model.onnx"
PREPROCESSED = OUT / "model-preprocessed.onnx"
INT8 = OUT / "model-int8.onnx"


class SyntheticCalibrationReader(CalibrationDataReader):
    """Small deterministic calibration set for conversion validation.

    These tensors follow the ImageNet-normalized scale expected by ViT.
    For production accuracy testing we should later calibrate with real plant
    photos, but this is sufficient to validate a browser-friendly QDQ graph.
    """

    def __init__(self, input_name: str, samples: int = 16):
        self.input_name = input_name
        rng = np.random.default_rng(42)
        self.rows = []
        for _ in range(samples):
            # Values roughly cover ImageNet-normalized RGB input ranges.
            x = rng.uniform(-2.2, 2.6, size=(1, 3, 224, 224)).astype(np.float32)
            self.rows.append({self.input_name: x})
        self._iter = iter(self.rows)

    def get_next(self):
        return next(self._iter, None)

    def rewind(self):
        self._iter = iter(self.rows)


def main():
    OUT.mkdir(exist_ok=True)
    if not FP32.exists():
        raise SystemExit(f"Missing exported model: {FP32}")

    config = AutoConfig.from_pretrained(MODEL_ID)
    id2label = {str(k): v for k, v in config.id2label.items()}
    (OUT / "labels.json").write_text(json.dumps(id2label, ensure_ascii=False), encoding="utf-8")

    cyclamen = [v for v in id2label.values() if v.lower() == "cyclamen persicum"]
    if not cyclamen:
        raise SystemExit("Cyclamen persicum is not present in model labels")
    print("Verified label: Cyclamen persicum")

    # Validate the FP32 graph first and discover its real input name.
    fp32_session = ort.InferenceSession(str(FP32), providers=["CPUExecutionProvider"])
    input_name = fp32_session.get_inputs()[0].name

    print("Pre-processing ONNX graph for static quantization...")
    if PREPROCESSED.exists():
        PREPROCESSED.unlink()
    quant_pre_process(
        input_model_path=str(FP32),
        output_model_path=str(PREPROCESSED),
        skip_symbolic_shape=False,
        skip_optimization=False,
        skip_onnx_shape=False,
    )

    print("Quantizing ONNX model to static INT8 QDQ...")
    reader = SyntheticCalibrationReader(input_name=input_name, samples=16)
    quantize_static(
        model_input=str(PREPROCESSED),
        model_output=str(INT8),
        calibration_data_reader=reader,
        quant_format=QuantFormat.QDQ,
        activation_type=QuantType.QUInt8,
        weight_type=QuantType.QInt8,
        calibrate_method=CalibrationMethod.MinMax,
        per_channel=True,
        reduce_range=False,
        extra_options={
            "ActivationSymmetric": False,
            "WeightSymmetric": True,
            "DedicatedQDQPair": False,
        },
    )

    # The key regression test: the quantized graph must load and run on CPU.
    session = ort.InferenceSession(str(INT8), providers=["CPUExecutionProvider"])
    input_meta = session.get_inputs()[0]
    input_name = input_meta.name
    sample = np.random.default_rng(7).uniform(-2.2, 2.6, size=(1, 3, 224, 224)).astype(np.float32)
    outputs = session.run(None, {input_name: sample})
    if not outputs or outputs[0].ndim != 2:
        raise SystemExit("Unexpected ONNX output shape")
    if outputs[0].shape[1] != len(id2label):
        raise SystemExit(f"Output classes {outputs[0].shape[1]} != labels {len(id2label)}")

    print(f"QDQ INT8 inference OK: input={input_name}, output_shape={outputs[0].shape}")
    for path in [FP32, INT8]:
        print(f"{path}: {path.stat().st_size / (1024**2):.1f} MiB")

    summary = {
        "model_id": MODEL_ID,
        "quantization": "static-int8-qdq",
        "calibration": "synthetic-validation-set",
        "classes": len(id2label),
        "cyclamen_persicum_present": True,
        "fp32_mib": round(FP32.stat().st_size / (1024**2), 1),
        "int8_mib": round(INT8.stat().st_size / (1024**2), 1),
        "output_shape": list(outputs[0].shape),
    }
    (OUT / "conversion-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    # Keep the artifact smaller: the preprocessed intermediate is not needed.
    if PREPROCESSED.exists():
        PREPROCESSED.unlink()


if __name__ == "__main__":
    main()
