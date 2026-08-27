from pathlib import Path
import json
import os
import numpy as np
import onnxruntime as ort
from onnxruntime.quantization import quantize_dynamic, QuantType
from transformers import AutoConfig

MODEL_ID = "domai-tb/OpenPlants-Identification-ViT-Base-Patch16-224"
OUT = Path("openplants-onnx")
FP32 = OUT / "model.onnx"
INT8 = OUT / "model-int8.onnx"


def main():
    OUT.mkdir(exist_ok=True)
    if not FP32.exists():
        raise SystemExit(f"Missing exported model: {FP32}")

    print("Quantizing ONNX model to INT8...")
    quantize_dynamic(
        model_input=str(FP32),
        model_output=str(INT8),
        weight_type=QuantType.QInt8,
        per_channel=False,
        reduce_range=False,
    )

    config = AutoConfig.from_pretrained(MODEL_ID)
    id2label = {str(k): v for k, v in config.id2label.items()}
    (OUT / "labels.json").write_text(json.dumps(id2label, ensure_ascii=False), encoding="utf-8")

    cyclamen = [v for v in id2label.values() if v.lower() == "cyclamen persicum"]
    if not cyclamen:
        raise SystemExit("Cyclamen persicum is not present in model labels")
    print("Verified label: Cyclamen persicum")

    session = ort.InferenceSession(str(INT8), providers=["CPUExecutionProvider"])
    input_meta = session.get_inputs()[0]
    input_name = input_meta.name
    shape = [1, 3, 224, 224]
    sample = np.random.default_rng(42).normal(size=shape).astype(np.float32)
    outputs = session.run(None, {input_name: sample})
    if not outputs or outputs[0].ndim != 2:
        raise SystemExit("Unexpected ONNX output shape")
    if outputs[0].shape[1] != len(id2label):
        raise SystemExit(f"Output classes {outputs[0].shape[1]} != labels {len(id2label)}")

    print(f"INT8 inference OK: input={input_name}, output_shape={outputs[0].shape}")
    for path in [FP32, INT8]:
        print(f"{path}: {path.stat().st_size / (1024**2):.1f} MiB")

    summary = {
        "model_id": MODEL_ID,
        "classes": len(id2label),
        "cyclamen_persicum_present": True,
        "fp32_mib": round(FP32.stat().st_size / (1024**2), 1),
        "int8_mib": round(INT8.stat().st_size / (1024**2), 1),
        "output_shape": list(outputs[0].shape),
    }
    (OUT / "conversion-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
