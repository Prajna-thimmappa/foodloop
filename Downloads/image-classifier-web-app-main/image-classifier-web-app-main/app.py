import os

import h5py
import numpy as np
from flask import Flask, render_template, request, send_from_directory
from PIL import Image
from tensorflow.keras.applications.mobilenet_v2 import (
    MobileNetV2,
    decode_predictions,
    preprocess_input,
)
from tensorflow.keras.preprocessing import image as keras_image

app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = os.path.join(os.getcwd(), "uploads")
app.config["ALLOWED_EXTENSIONS"] = {".png", ".jpg", ".jpeg", ".webp"}
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024

os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)


def load_model():
    cache_dir = os.path.join(os.path.expanduser("~"), ".keras", "models")
    weights_names = [
        "mobilenet_v2_weights_tf_dim_ordering_tf_kernels_1.0_224.h5",
        "mobilenet_v2_weights_tf_dim_ordering_tf_kernels_1.0_224.h5",
    ]

    for file_name in weights_names:
        weight_path = os.path.join(cache_dir, file_name)
        if not os.path.exists(weight_path):
            continue
        try:
            with h5py.File(weight_path, "r"):
                pass
        except Exception:
            os.remove(weight_path)

    return MobileNetV2(weights="imagenet")


model = load_model()


def allowed_file(filename: str) -> bool:
    return "." in filename and os.path.splitext(filename)[1].lower() in app.config["ALLOWED_EXTENSIONS"]


def predict_image(file_path: str):
    img = keras_image.load_img(file_path, target_size=(224, 224))
    img_array = keras_image.img_to_array(img)
    img_array = np.expand_dims(img_array, axis=0)
    img_array = preprocess_input(img_array)

    prediction = model.predict(img_array, verbose=0)
    decoded = decode_predictions(prediction, top=1)[0][0]

    return {
        "label": decoded[1].replace("_", " ").title(),
        "confidence": round(float(decoded[2]) * 100, 2),
        "class_name": decoded[1],
    }


@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")


@app.route("/predict", methods=["POST"])
def predict():
    if "file" not in request.files:
        return render_template("index.html", error="Please upload an image file."), 400

    uploaded_file = request.files["file"]
    if uploaded_file.filename == "":
        return render_template("index.html", error="Please choose an image before submitting."), 400

    if not allowed_file(uploaded_file.filename):
        return render_template(
            "index.html",
            error="Unsupported file type. Please upload a JPG, JPEG, PNG, or WEBP image.",
        ), 400

    file_extension = os.path.splitext(uploaded_file.filename)[1].lower()
    file_name = f"uploaded_image{file_extension}"
    file_path = os.path.join(app.config["UPLOAD_FOLDER"], file_name)

    uploaded_file.save(file_path)

    try:
        with Image.open(file_path) as img:
            img.verify()
    except Exception:
        return render_template("index.html", error="The uploaded file is not a valid image."), 400

    result = predict_image(file_path)
    return render_template(
        "index.html",
        uploaded_image=f"/uploads/{file_name}",
        label=result["label"],
        confidence=result["confidence"],
    )


@app.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
