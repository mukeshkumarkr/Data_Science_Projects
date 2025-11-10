import tensorflow as tf
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import GlobalAveragePooling2D, Dense
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint
import matplotlib.pyplot as plt
import numpy as np
import json
import os
from sklearn.metrics import classification_report, confusion_matrix
import seaborn as sns
import pandas as pd

# ------------------- Paths & params -------------------
data_dir = "/Users/tysonmukesh/desktop/final projects/testing copy/ingredients"
img_size = (224, 224)
batch_size = 32
metrics_dir = "model_metrics"
os.makedirs(metrics_dir, exist_ok=True)

# ------------------- Augmented training data generator -------------------
train_datagen = ImageDataGenerator(
    preprocessing_function=preprocess_input,
    validation_split=0.3,
    rotation_range=20,
    width_shift_range=0.1,
    height_shift_range=0.1,
    zoom_range=0.2,
    shear_range=0.15,
    horizontal_flip=True,
    fill_mode='nearest'
)

train_data = train_datagen.flow_from_directory(
    data_dir,
    target_size=img_size,
    batch_size=batch_size,
    class_mode='categorical',
    subset='training',
    shuffle=True,
    seed=42
)

# ------------------- Save class indices as JSON -------------------
class_indices_path = "class_indices.json"
with open(class_indices_path, "w") as f:
    json.dump(train_data.class_indices, f, indent=4)
print(f"✅ Class indices saved to {class_indices_path}")

# ------------------- Validation/Test generator -------------------
val_test_datagen = ImageDataGenerator(preprocessing_function=preprocess_input, validation_split=0.5)

val_data = val_test_datagen.flow_from_directory(
    data_dir,
    target_size=img_size,
    batch_size=batch_size,
    class_mode='categorical',
    subset='validation',
    shuffle=False,
    seed=42
)

test_data = val_test_datagen.flow_from_directory(
    data_dir,
    target_size=img_size,
    batch_size=batch_size,
    class_mode='categorical',
    subset='training',
    shuffle=False,
    seed=42
)

# ------------------- Base MobileNetV2 -------------------
base_model = MobileNetV2(input_shape=img_size + (3,), include_top=False, weights='imagenet')
base_model.trainable = False  # Phase 1 - freeze all

# ------------------- Build model -------------------
model = Sequential([
    base_model,
    GlobalAveragePooling2D(),
    Dense(128, activation='relu'),
    Dense(train_data.num_classes, activation='softmax')
])

model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])

# ------------------- Callbacks -------------------
checkpoint_path_phase1 = "ingredient_detector_phase1.keras"
callbacks_phase1 = [
    EarlyStopping(monitor='val_accuracy', patience=5, restore_best_weights=True, verbose=1),
    ModelCheckpoint(checkpoint_path_phase1, monitor='val_accuracy', save_best_only=True, verbose=1)
]

# -------- PHASE 1: Train top layers --------
history1 = model.fit(
    train_data,
    validation_data=val_data,
    epochs=30,  
    callbacks=callbacks_phase1
)

# Save Phase 1 model in H5
model.save("ingredient_detector_phase1_final.h5")

# -------- PHASE 2: Fine-tune last layers --------
for layer in base_model.layers[-20:]:
    layer.trainable = True

model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
              loss='categorical_crossentropy', metrics=['accuracy'])

checkpoint_path_phase2 = "ingredient_detector_finetuned.keras"
callbacks_phase2 = [
    EarlyStopping(monitor='val_accuracy', patience=5, restore_best_weights=True, verbose=1),
    ModelCheckpoint(checkpoint_path_phase2, monitor='val_accuracy', save_best_only=True, verbose=1)
]

history2 = model.fit(
    train_data,
    validation_data=val_data,
    epochs=20,  
    callbacks=callbacks_phase2
)

# Save Phase 2 model in H5
model.save("ingredient_detector_finetuned_final.h5")

# ------------------- Evaluation -------------------
test_loss, test_accuracy = model.evaluate(test_data)
print(f"\n✅ Final Test Accuracy: {test_accuracy * 100:.2f}%")
print(f"❌ Final Test Loss: {test_loss:.4f}")

# ------------------- Epoch Accuracy & Loss Plots -------------------
def plot_history(history_list, metrics_dir):
    # Merge phase1 and phase2
    acc = history_list[0].history['accuracy'] + history_list[1].history['accuracy']
    val_acc = history_list[0].history['val_accuracy'] + history_list[1].history['val_accuracy']
    loss = history_list[0].history['loss'] + history_list[1].history['loss']
    val_loss = history_list[0].history['val_loss'] + history_list[1].history['val_loss']
    epochs = range(1, len(acc) + 1)

    # Accuracy
    plt.figure(figsize=(10, 5))
    plt.plot(epochs, acc, label='Train Accuracy')
    plt.plot(epochs, val_acc, label='Validation Accuracy')
    plt.xlabel("Epochs")
    plt.ylabel("Accuracy")
    plt.title("Training & Validation Accuracy")
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    plt.savefig(os.path.join(metrics_dir, "accuracy_plot.png"))
    plt.show()

    # Loss
    plt.figure(figsize=(10, 5))
    plt.plot(epochs, loss, label='Train Loss')
    plt.plot(epochs, val_loss, label='Validation Loss')
    plt.xlabel("Epochs")
    plt.ylabel("Loss")
    plt.title("Training & Validation Loss")
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    plt.savefig(os.path.join(metrics_dir, "loss_plot.png"))
    plt.show()

plot_history([history1, history2], metrics_dir)

# ------------------- Metrics -------------------
y_pred_probs = model.predict(test_data)
y_pred = np.argmax(y_pred_probs, axis=1)
y_true = test_data.classes
class_labels = list(test_data.class_indices.keys())

# Ensure correct mapping for classification report
unique_labels = np.unique(y_true)
report = classification_report(y_true, y_pred, labels=unique_labels, target_names=[class_labels[i] for i in unique_labels], output_dict=True)
print("\nClassification Report:")
print(classification_report(y_true, y_pred, labels=unique_labels, target_names=[class_labels[i] for i in unique_labels]))

# Save metrics
with open(os.path.join(metrics_dir, "metrics.json"), "w") as f:
    json.dump(report, f, indent=4)

# Confusion matrix
cm = confusion_matrix(y_true, y_pred, labels=unique_labels)
cm_df = pd.DataFrame(cm, index=[class_labels[i] for i in unique_labels], columns=[class_labels[i] for i in unique_labels])
cm_df.to_csv(os.path.join(metrics_dir, "confusion_matrix.csv"))

plt.figure(figsize=(12, 8))
sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
            xticklabels=[class_labels[i] for i in unique_labels], 
            yticklabels=[class_labels[i] for i in unique_labels])
plt.xlabel("Predicted")
plt.ylabel("True")
plt.title("Confusion Matrix")
plt.tight_layout()
plt.savefig(os.path.join(metrics_dir, "confusion_matrix.png"))
plt.show()

# Precision/Recall/F1 bar chart
precision_scores = [report[label]["precision"] for label in [class_labels[i] for i in unique_labels]]
recall_scores = [report[label]["recall"] for label in [class_labels[i] for i in unique_labels]]
f1_scores = [report[label]["f1-score"] for label in [class_labels[i] for i in unique_labels]]

x = np.arange(len(unique_labels))
width = 0.25
plt.figure(figsize=(12, 6))
plt.bar(x - width, precision_scores, width, label="Precision")
plt.bar(x, recall_scores, width, label="Recall")
plt.bar(x + width, f1_scores, width, label="F1-score")
plt.xticks(x, [class_labels[i] for i in unique_labels], rotation=45, ha="right")
plt.ylabel("Score")
plt.ylim(0, 1)
plt.title("Precision, Recall, and F1-score per Class")
plt.legend()
plt.tight_layout()
plt.savefig(os.path.join(metrics_dir, "scores_bar_chart.png"))
plt.show()

print(f"\n✅ Phase 1 model saved: ingredient_detector_phase1_final.h5")
print(f"✅ Fine-tuned model saved: ingredient_detector_finetuned_final.h5")
print(f"✅ Best model weights: {checkpoint_path_phase2}")
print(f"✅ Metrics and plots in: {metrics_dir}")
