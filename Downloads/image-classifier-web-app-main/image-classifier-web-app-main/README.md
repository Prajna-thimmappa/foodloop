# Image Classifier Web App

A Flask web app that lets users upload an image and classify it with a pretrained MobileNetV2 model from ImageNet.

## Features

- Upload an image from the browser
- Classify it with MobileNetV2
- Show the predicted label and confidence score
- Clean responsive web interface

## Project structure

- `app.py` – Flask application logic and model loading
- `templates/index.html` – upload form and prediction result page
- `static/style.css` – styling for the app
- `requirements.txt` – Python dependencies

## Setup

1. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the app:
   ```bash
   python app.py
   ```

4. Open your browser and go to:
   ```text
   http://localhost:5000
   ```

## Notes

- TensorFlow will download the MobileNetV2 ImageNet weights on first run.
- Large model downloads may take a few minutes depending on your internet connection.
