from flask import Flask, render_template, request
import json
from rapidfuzz import fuzz
from flask import jsonify
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import img_to_array
from PIL import Image
import numpy as np
import io
import os

app = Flask(__name__)

# Load recipe data
with open('recipes.json', 'r', encoding='utf-8') as f:
    recipes = json.load(f)
print(f"📦 Loaded {len(recipes)} recipes.")


def load_mode_titles(mode_name):
    if not mode_name:
        return None  # No filtering

    mode_file = f"modes/{mode_name.lower()}mode.txt"
    if not os.path.exists(mode_file):
        return None

    with open(mode_file, 'r', encoding='utf-8') as f:
        return {line.strip().lower() for line in f if line.strip()}

def match_recipes(user_ingredients, mode_titles=None):
    user_ingredients = [i.strip().lower() for i in user_ingredients]
    results = []

    for recipe in recipes:
        recipe_title = recipe['title'].strip().lower()

        # 🧠 If mode filtering is active, skip non-matching titles
        if mode_titles and recipe_title not in mode_titles:
            continue

        ingredient_lines = recipe['ingredients']
        matched_keywords = set()
        all_matched = True

        ingredient_keywords = set()
        for line in ingredient_lines:
            words = line.lower().split()
            ingredient_keywords.update(words)

        for ui in user_ingredients:
            matched = False
            for keyword in ingredient_keywords:
                if fuzz.ratio(ui, keyword) >= 85:
                    matched_keywords.add(ui)
                    matched = True
                    break
            if not matched:
                all_matched = False
                break

        if all_matched:
            highlighted_ingredients = []
            for line in ingredient_lines:
                words = line.lower().split()
                if any(fuzz.ratio(ui, word) >= 85 for ui in user_ingredients for word in words):
                    highlighted_ingredients.append(f"<b>{line}</b>")
                else:
                    highlighted_ingredients.append(line)

            results.append({
                "title": recipe["title"],
                "cuisine": recipe.get("cuisine", "Unknown"),
                "ready_in": recipe.get("ready_in", "Unknown"),
                "matches": list(matched_keywords),
                "all_ingredients": highlighted_ingredients,
                "match_count": len(matched_keywords),
                "total_ingredients": len(ingredient_lines),
                "instructions": recipe["instructions"]
            })

    return sorted(results, key=lambda x: x["match_count"], reverse=True)

@app.route("/", methods=["GET", "POST"])
def index():
    print(f"Request method: {request.method}")
    suggestions = []
    searched = False

    if request.method == "POST":
        mode = request.form.get("mode")  # <-- Get from form POST data here
    else:
        mode = request.args.get("mode")  # fallback for GET

    print(f"Mode received: {mode}")
    mode_titles = load_mode_titles(mode)

    if request.method == "POST":
        ingredients_input = request.form.get("ingredients")
        print("Ingredients input:", ingredients_input)
        searched = True

        try:
            tags = json.loads(ingredients_input)
            user_ingredients = [tag["value"].strip().lower() for tag in tags]

            suggestions = match_recipes(user_ingredients, mode_titles=mode_titles)
        except Exception as e:
            print("Error:", e)

    return render_template("index.html", suggestions=suggestions, searched=searched, mode=mode, all_recipes=recipes )

@app.route("/all_recipes")
def all_recipes():
    mode = request.args.get("mode", "").strip()
    mode_titles = load_mode_titles(mode)

    # If no mode or no txt file, return all recipes
    if not mode_titles:
        filtered_recipes = recipes
    else:
        filtered_recipes = [r for r in recipes if r['title'].strip().lower() in mode_titles]

    # Simplify data to send
    simplified = [{
        "title": r["title"],
        "cuisine": r.get("cuisine", "Unknown"),
        "ready_in": r.get("ready_in", "Unknown"),
        "all_ingredients": r.get("ingredients", []),
        "instructions": r.get("instructions", [])
    } for r in filtered_recipes]

    return jsonify(simplified)

model = load_model('ingredient_detector_model.h5')
with open('class_indices.json', 'r') as f:
    class_indices = json.load(f)
index_to_class = {v: k for k, v in class_indices.items()}

def prepare_image(image, target_size=(224, 224)):
    if image.mode != 'RGB':
        image = image.convert('RGB')
    image = image.resize(target_size)
    image = img_to_array(image) / 255.0
    image = np.expand_dims(image, axis=0)
    return image

@app.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400

    file = request.files['image']
    img_bytes = file.read()
    image = Image.open(io.BytesIO(img_bytes))
    processed_image = prepare_image(image)

    preds = model.predict(processed_image)
    class_index = np.argmax(preds, axis=1)[0]
    class_name = index_to_class.get(class_index, "Unknown")

    return jsonify({'prediction': class_name})


if __name__ == "__main__":
    app.run(debug=True)
