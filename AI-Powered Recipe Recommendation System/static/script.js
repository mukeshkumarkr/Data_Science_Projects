function loadCustomModeCSS() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get("mode");

    document.body.classList.remove("spicy", "lazy", "party");

    const modeCssLink = document.getElementById("mode-css");
    if (mode && ['spicy', 'lazy', 'party'].includes(mode)) {
        if (modeCssLink) {
            modeCssLink.href = `/static/${mode}-mode.css`;
        }
        document.body.classList.add(mode);
    } else {
        if (modeCssLink) {
            modeCssLink.href = "";
        }
    }


    const isAllMode = !mode || mode.trim() === "";

    // Show/Hide the literal Favorites and Bookmarks buttons (not card buttons)
    const showRecipesBtn = document.getElementById("show-recipes-btn");
    const showBookmarksBtn = document.getElementById("show-bookmarks-btn");
    const showFavoritesBtn = document.getElementById("show-favorites-btn");

    if (showRecipesBtn) showRecipesBtn.style.display = 'inline-block';
    if (showBookmarksBtn) showBookmarksBtn.style.display = isAllMode ? 'inline-block' : 'none';
    if (showFavoritesBtn) showFavoritesBtn.style.display = isAllMode ? 'inline-block' : 'none';
}


function toggleDetails(index) {
  const details = document.getElementById(`details-${index}`);
  if (details) {
    details.classList.toggle('hidden');
  }
}

function startCooking(index) {
  const stepsScript = document.getElementById(`steps-data-${index}`);
  if (!stepsScript) return;
  
  window.currentSteps = JSON.parse(stepsScript.textContent);
  window.currentStepIndex = 0;
  
  document.getElementById('step-text').innerText = window.currentSteps[0];
  document.getElementById('step-mode').classList.remove('hidden');
  
  if (typeof speak === 'function') speak(window.currentSteps[0]);
  if (typeof startVoiceRecognition === 'function') startVoiceRecognition();
  
  attachStepControlListeners();
}

// Create a global lookup of all recipe data by title
const allRecipesData = {};
document.querySelectorAll(".recipe.card").forEach((card) => {
  const title = card.querySelector("h3")?.textContent?.trim();
  if (!title) return;

  // Extract ingredients and instructions from card DOM
  const allIngredients = Array.from(card.querySelectorAll("ul li")).map(li => li.textContent.trim());
  const instructions = Array.from(card.querySelectorAll("ol li")).map(li => li.textContent.trim());

  allRecipesData[title] = {
    all_ingredients: allIngredients,
    instructions: instructions
  };
});


document.addEventListener("DOMContentLoaded", function () {
    loadCustomModeCSS();
    document.querySelectorAll('.show-button').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const index = e.target.dataset.index;
        toggleDetails(index);  // define this function in JS
    });
    });

    document.querySelectorAll('.show-button').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (e.target.textContent.includes('▶️')) {
        const index = e.target.dataset.index;
        startCooking(index);  // define this function in JS
        }
    });
    });


    // Tagify ingredient input with colors
    const input = document.getElementById('ingredient-input');
    const colors = ['#FF6B6B', '#4ECDC4', '#FFD93D', '#6A89CC', '#C56CF0', '#F19066', '#55E6C1'];
    const colorMap = {};  // Maps ingredient name -> color
    let nextColorIndex = 0;

    const tagify = new Tagify(input, {
        transformTag: (tagData) => {
            const val = tagData.value.toLowerCase();
            if (!colorMap[val]) {
                colorMap[val] = colors[nextColorIndex];
                nextColorIndex = (nextColorIndex + 1) % colors.length;
            }
            tagData.style = `--tag-bg: ${colorMap[val]}; --tag-text-color: #000;`;
            return tagData;
        }
    });
    input.tagify = tagify;

    // Reset button reloads page
    document.getElementById('reset-btn').addEventListener('click', () => {
    // Reload the page while keeping current query params (like mode)
        window.location.href = window.location.href.split('#')[0];
    });

    // Image upload & find ingredient logic
    const fileInput = document.getElementById('image-upload-input');
    const findBtn = document.getElementById('find-btn');
    const submitBtn = document.getElementById('submit-btn');
    const preview = document.getElementById('image-preview');
    const predictionResult = document.getElementById('prediction-result');

    findBtn.style.display = 'none';
    submitBtn.style.display = 'none';

    fileInput.addEventListener('change', function(event) {
        const file = event.target.files[0];

        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);

            findBtn.style.display = 'inline-block';
            submitBtn.style.display = 'none';
            predictionResult.textContent = '';
        } else {
            preview.src = '';
            preview.style.display = 'none';
            findBtn.style.display = 'none';
            submitBtn.style.display = 'none';
            predictionResult.textContent = '';
        }
    });

    document.getElementById('modal-close-cross').addEventListener('click', closeImageModal);
    document.getElementById('modal-overlay').addEventListener('click', closeImageModal);

    // Voice input for ingredient tags
    window.startIngredientVoiceInput = function () {
        const micButton = document.getElementById('mic-button');
        const dots = micButton.querySelector('.listening-dots');

        if (!('webkitSpeechRecognition' in window)) {
            alert("Voice recognition is not supported in this browser. Please use Google Chrome.");
            return;
        }

        const recognition = new webkitSpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = function () {
            console.log("🎙️ Voice input started...");
            dots.style.display = 'inline-flex';
        };

        recognition.onresult = function (event) {
            const transcript = event.results[0][0].transcript.trim();
            console.log("🎧 Transcript:", transcript);

            if (transcript) {
                const tagifyInstance = document.querySelector('#ingredient-input').tagify;
                tagifyInstance.addTags([transcript]);
                speak(transcript);
            } else {
                console.warn("⚠️ Empty transcript.");
                speak("Please repeat the ingredient");
            }
        };

        recognition.onerror = function (event) {
            console.error("❌ Voice input error:", event.error);
            speak("Please repeat the ingredient");
            dots.style.display = 'none';
        };

        recognition.onend = function () {
            console.log("🔇 Voice input ended.");
            dots.style.display = 'none';
        };

        recognition.start();
    };

    // Speak helper
    window.speak = function(text) {
        const synth = window.speechSynthesis;
        const utter = new SpeechSynthesisUtterance(text);
        synth.cancel();
        synth.speak(utter);
    };

    // Step mode variables
    window.currentStepIndex = 0;
    window.currentSteps = [];
    window.recognition = null;
    window.timerInterval = null;
    window.timeLeftInSeconds = 0;
    window.isPaused = false;

    // Step control functions
    window.nextStep = function() {
        if (window.currentStepIndex < window.currentSteps.length - 1) {
            window.currentStepIndex++;
            document.getElementById('step-text').innerText = window.currentSteps[window.currentStepIndex];
            speak(window.currentSteps[window.currentStepIndex]);
        }
    };

    window.repeatStep = function() {
        speak(window.currentSteps[window.currentStepIndex]);
    };

    window.goBackStep = function() {
        if (window.currentStepIndex > 0) {
            window.currentStepIndex--;
            document.getElementById('step-text').innerText = window.currentSteps[window.currentStepIndex];
            speak(window.currentSteps[window.currentStepIndex]);
        }
    };

    window.endCooking = function() {
        document.getElementById('step-mode').classList.add('hidden');
        window.currentSteps = [];
        window.currentStepIndex = 0;
        stopVoiceRecognition();
    };

    window.attachStepControlListeners = function() {
        const stepButtons = document.querySelectorAll('#step-mode .step-buttons button');
        if (stepButtons.length >= 4) {
            stepButtons[0].onclick = window.nextStep;
            stepButtons[1].onclick = window.repeatStep;
            stepButtons[2].onclick = window.goBackStep;
            stepButtons[3].onclick = window.endCooking;
        }
    };

    window.startVoiceRecognition = function() {
        if (!('webkitSpeechRecognition' in window)) {
            alert("Voice recognition not supported in this browser.");
            return;
        }

        window.recognition = new webkitSpeechRecognition();
        window.recognition.continuous = true;
        window.recognition.interimResults = false;
        window.recognition.lang = 'en-US';

        window.recognition.onresult = function(event) {
    for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
            const command = event.results[i][0].transcript.trim().toLowerCase();
            console.log("🎙️ Command:", command);

            if (command.includes("next")) {
                window.nextStep();
            } else if (command.includes("repeat")) {
                window.repeatStep();
            } else if (command.includes("back") || command.includes("go back")) {
                window.goBackStep();
            } else if (command.includes("exit") || command.includes("stop cooking")) {
                window.endCooking();
            } else if (/pause.*timer/.test(command)) {
                window.pauseTimer();
            } else if (/resume.*timer/.test(command)) {
                window.resumeTimer();
            } else if (/stop.*timer|cancel.*timer/.test(command)) {
                window.stopTimer();
            } else if (command.includes("timer")) {
                parseAndSetTimer(command);
            }

        }
    }
};


        window.recognition.onerror = function(event) {
            console.log("Speech recognition error:", event.error);
        };

        window.recognition.start();
    };

    function stopVoiceRecognition() {
        if (window.recognition) {
            window.recognition.stop();
        }
    }

    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") {
            if (!window.recognition || window.recognition?.running === false) {
                if (!document.getElementById('step-mode').classList.contains('hidden')) {
                    console.log("🔁 Restarting voice recognition after tab switch...");
                    window.startVoiceRecognition();
                }
            }
        }
    });

    // Timer related functions
    function parseAndSetTimer(command) {
        const match = command.match(/(\d+)\s*(second|minute|minutes|seconds)/);
        if (match) {
            let duration = parseInt(match[1]);
            const unit = match[2];

            if (unit.includes('minute')) {
                window.timeLeftInSeconds = duration * 60;
            } else {
                window.timeLeftInSeconds = duration;
            }

            startTimer(window.timeLeftInSeconds);
        } else {
            speak("Sorry, I couldn't understand the timer duration.");
        }
    }

    function startTimer(seconds) {
        window.timeLeftInSeconds = seconds;
        window.isPaused = false;

        document.getElementById("floating-timer").classList.remove("hidden");
        updateTimerDisplay();

        speak(`Timer started for ${Math.floor(seconds / 60)} minutes and ${seconds % 60} seconds.`);

        window.timerInterval = setInterval(() => {
            if (!window.isPaused && window.timeLeftInSeconds > 0) {
                window.timeLeftInSeconds--;
                updateTimerDisplay();

                if (window.timeLeftInSeconds === 0) {
                    clearInterval(window.timerInterval);
                    speak("Time's up!");
                    document.getElementById("floating-timer").classList.add("hidden");
                }
            }
        }, 1000);
    }

    function updateTimerDisplay() {
        const mins = String(Math.floor(window.timeLeftInSeconds / 60)).padStart(2, '0');
        const secs = String(window.timeLeftInSeconds % 60).padStart(2, '0');
        document.getElementById("timer-display").innerText = `${mins}:${secs}`;
    }

    window.pauseTimer = function() {
        window.isPaused = true;
        speak("Timer paused.");
    };

    window.resumeTimer = function() {
        if (window.isPaused && window.timeLeftInSeconds > 0) {
            window.isPaused = false;
            speak("Timer resumed.");
        }
    };

    window.stopTimer = function() {
        clearInterval(window.timerInterval);
        window.timeLeftInSeconds = 0;
        window.isPaused = false;
        document.getElementById("floating-timer").classList.add("hidden");
        speak("Timer stopped.");
    };

    // Modal open/close and image submit/find
    window.openImageModal = function() {
        document.getElementById('image-modal').style.display = 'block';
        document.getElementById('modal-overlay').style.display = 'block';
    };

    function closeImageModal() {
        document.getElementById('image-modal').style.display = 'none';
        document.getElementById('modal-overlay').style.display = 'none';
        const fileInput = document.getElementById('image-upload-input');
        const preview = document.getElementById('image-preview');
        const findBtn = document.getElementById('find-btn');
        const submitBtn = document.getElementById('submit-btn');

        fileInput.value = null;
        preview.src = '';
        preview.style.display = 'none';
        document.getElementById('prediction-result').textContent = '';

        findBtn.style.display = 'none';
        submitBtn.style.display = 'none';
    }

    window.closeImageModal = closeImageModal;

    window.submitImage = function() {
        const predictionResult = document.getElementById('prediction-result').textContent;

        if (!predictionResult || !predictionResult.includes("Identified ingredient:")) {
            alert("Please find the ingredient first using the Find button.");
            return;
        }

        const ingredientName = predictionResult.replace("Identified ingredient: ", "").trim();
        if (!ingredientName) {
            alert("No ingredient identified to add.");
            return;
        }

        const tagifyInstance = document.querySelector('#ingredient-input').tagify;
        tagifyInstance.addTags([ingredientName]);

        closeImageModal();
    };

    window.findIngredient = function() {
        const fileInput = document.getElementById('image-upload-input');
        const predictionResult = document.getElementById('prediction-result');
        const submitBtn = document.getElementById('submit-btn');

        if (fileInput.files.length === 0) {
            alert("Please select an image first.");
            return;
        }

        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('image', file);

        fetch('/predict', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.prediction) {
                predictionResult.textContent = "Identified ingredient: " + data.prediction;
                submitBtn.style.display = 'inline-block';
                findBtn.style.display = 'none';
            } else {
                predictionResult.textContent = "Could not identify ingredient.";
                submitBtn.style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            predictionResult.textContent = "Error during prediction.";
            submitBtn.style.display = 'none';
        });
    };

    // Dark mode toggle logic
    const darkModeEnabled = localStorage.getItem('darkModeEnabled');
    const toggleBtn = document.getElementById('dark-mode-toggle');
    const sunIconClass = 'fa-sun';
    const moonIconClass = 'fa-moon';
    const icon = toggleBtn.querySelector('i');

    if (darkModeEnabled === 'true') {
        document.body.classList.add('dark');
        icon.classList.remove(sunIconClass);
        icon.classList.add(moonIconClass);
    } else {
        document.body.classList.remove('dark');
        icon.classList.remove(moonIconClass);
        icon.classList.add(sunIconClass);
    }

    toggleBtn.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark');
        localStorage.setItem('darkModeEnabled', isDark ? 'true' : 'false');

        icon.classList.toggle(sunIconClass, !isDark);
        icon.classList.toggle(moonIconClass, isDark);
    });

    // Radial mode selector logic
    const modeToggleBtn = document.getElementById("mode-toggle-btn");
    const radialMenu = document.getElementById("mode-radial-menu");
    const modeHiddenInput = document.getElementById("mode-hidden-input");
    const currentModeIcon = document.getElementById("current-mode-icon");

    const modeIcons = {
        "": "🌐",
        "spicy": "🌶️",
        "lazy": "😴",
        "party": "🎉"
    };

    let currentMode = modeHiddenInput.value || "";
    currentModeIcon.textContent = modeIcons[currentMode] || "🌐";

    radialMenu.querySelectorAll(".mode-btn").forEach(btn => {
        if (btn.getAttribute("data-mode") === currentMode) {
            btn.style.display = "none";
        } else {
            btn.style.display = "flex";
        }
    });

    modeToggleBtn.addEventListener("click", () => {
        const expanded = modeToggleBtn.getAttribute("aria-expanded") === "true";
        modeToggleBtn.setAttribute("aria-expanded", !expanded);
        radialMenu.classList.toggle("visible");
    });

    radialMenu.querySelectorAll(".mode-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const selectedMode = btn.getAttribute("data-mode");

            radialMenu.classList.remove("visible");
            modeToggleBtn.setAttribute("aria-expanded", false);

            if (selectedMode !== currentMode) {
                const baseUrl = window.location.origin + window.location.pathname;
                if (selectedMode) {
                    window.location.href = `${baseUrl}?mode=${selectedMode}`;
                } else {
                    window.location.href = baseUrl;
                }
            }
        });
    });

    document.addEventListener("click", (e) => {
        if (!modeToggleBtn.contains(e.target) && !radialMenu.contains(e.target)) {
            radialMenu.classList.remove("visible");
            modeToggleBtn.setAttribute("aria-expanded", false);
        }
    });

});
document.addEventListener('DOMContentLoaded', () => {
  const filterInput = document.getElementById('recipe-filter-input');
  const tableBody = document.querySelector('#recipe-list-table tbody');

  if (filterInput && tableBody) {
    filterInput.addEventListener('input', () => {
      const search = filterInput.value.toLowerCase();
      const rows = tableBody.querySelectorAll('tr');

      rows.forEach(row => {
        const recipeNameCell = row.querySelector('td');
        const recipeName = recipeNameCell?.textContent?.toLowerCase() || '';
        row.style.display = recipeName.includes(search) ? '' : 'none';
      });
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const mainContent = document.getElementById('main-content');
  const recipeListPanel = document.getElementById("recipe-list-panel");
  const recipeTableBody = document.querySelector("#recipe-list-table tbody");
  const closeRecipeListBtn = document.getElementById("close-recipe-list");

  // Replace the populateRecipeList function with this corrected version:

function populateRecipeList(type = "all") {
  recipeTableBody.innerHTML = "";

  const bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "[]");
  const favorites = JSON.parse(localStorage.getItem("favorites") || "[]");

  // Fetch recipes from server like the other recipe list functionality
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get("mode") || "";

  fetch(`/all_recipes?mode=${mode}`)
    .then(res => res.json())
    .then(recipes => {
      if (recipes.length === 0) {
        recipeTableBody.innerHTML = `<tr><td colspan="2" style="padding: 8px;">No recipes found for this mode.</td></tr>`;
        return;
      }

      // Filter recipes based on type
      const filteredRecipes = recipes.filter(recipe => {
        if (type === "favorites") return favorites.includes(recipe.title);
        if (type === "bookmarks") return bookmarks.includes(recipe.title);
        return true; // "all" type
      });

      if (filteredRecipes.length === 0) {
        const message = type === "favorites" ? "No favorite recipes found." : 
                       type === "bookmarks" ? "No bookmarked recipes found." : 
                       "No recipes found.";
        recipeTableBody.innerHTML = `<tr><td colspan="2" style="padding: 8px;">${message}</td></tr>`;
        return;
      }

      filteredRecipes.forEach((recipe, index) => {
        // Main recipe row
        const row = document.createElement("tr");

        // Title cell
        const titleCell = document.createElement("td");
        titleCell.textContent = recipe.title;

        // Action cell with buttons
        const actionCell = document.createElement("td");

        const showBtn = document.createElement("button");
        showBtn.textContent = "👁️ Show";
        showBtn.className = "mode-colored-btn";

        const startBtn = document.createElement("button");
        startBtn.textContent = "▶️ Start Cooking";
        startBtn.className = "mode-colored-btn";

        actionCell.appendChild(showBtn);
        actionCell.appendChild(startBtn);

        row.appendChild(titleCell);
        row.appendChild(actionCell);

        recipeTableBody.appendChild(row);

        // Show button toggles a new row
        showBtn.addEventListener("click", () => {
          // If next sibling is already a details row, remove it
          if (row.nextElementSibling && row.nextElementSibling.classList.contains("recipe-details-row")) {
            row.nextElementSibling.remove();
            showBtn.textContent = "👁️ Show";
            return;
          }

          // Remove any other open detail rows
          recipeTableBody.querySelectorAll(".recipe-details-row").forEach(el => el.remove());

          // Create new details row
          const detailsRow = document.createElement("tr");
          detailsRow.className = "recipe-details-row";

          const detailsCell = document.createElement("td");
          detailsCell.colSpan = 2;
          detailsCell.style.padding = "12px";
          detailsCell.style.background = "var(--card-bg, #f9f9f9)";

          const detailsDiv = document.createElement("div");
          detailsDiv.classList.add("recipe-details");

          const ingTitle = document.createElement("p");
          ingTitle.innerHTML = "<strong>All Ingredients:</strong>";
          detailsDiv.appendChild(ingTitle);

          const ingList = document.createElement("ul");
          (recipe.all_ingredients || []).forEach(ing => {
            const li = document.createElement("li");
            li.innerHTML = ing;
            ingList.appendChild(li);
          });
          detailsDiv.appendChild(ingList);

          const instTitle = document.createElement("p");
          instTitle.innerHTML = "<strong>Instructions:</strong>";
          detailsDiv.appendChild(instTitle);

          const instList = document.createElement("ol");
          (recipe.instructions || []).forEach(step => {
            const li = document.createElement("li");
            li.textContent = step;
            instList.appendChild(li);
          });
          detailsDiv.appendChild(instList);

          detailsCell.appendChild(detailsDiv);
          detailsRow.appendChild(detailsCell);
          row.after(detailsRow);

          showBtn.textContent = "🙈 Hide";
        });

        // Start Cooking button logic
        startBtn.addEventListener("click", () => {
          window.currentSteps = recipe.instructions || [];
          window.currentStepIndex = 0;

          if (window.currentSteps.length === 0) return;

          document.getElementById('step-text').innerText = window.currentSteps[0];
          document.getElementById('step-mode').classList.remove('hidden');

          if (typeof speak === 'function') speak(window.currentSteps[0]);
          if (typeof startVoiceRecognition === 'function') startVoiceRecognition();

          attachStepControlListeners();

          closeRecipeList();
        });
      });

      mainContent.classList.add("slide-left");
      recipeListPanel.classList.add("show");
    })
    .catch(err => {
      console.error("Error fetching recipes:", err);
      recipeTableBody.innerHTML = `<tr><td colspan="2" style="padding: 8px;">Error loading recipes.</td></tr>`;
    });
}
  // Event listeners for buttons (show panel only on click)
  document.getElementById("show-recipes-btn").addEventListener("click", () => populateRecipeList("all"));
  document.getElementById("show-bookmarks-btn").addEventListener("click", () => populateRecipeList("bookmarks"));
  document.getElementById("show-favorites-btn").addEventListener("click", () => populateRecipeList("favorites"));

  closeRecipeListBtn.addEventListener("click", () => {
    recipeListPanel.classList.remove("show");
    mainContent.classList.remove("slide-left");
  });
});


document.querySelectorAll(".card-actions").forEach(card => {
  const title = card.dataset.title;
  const bookmarkBtn = card.querySelector(".bookmark-btn");
  const favoriteBtn = card.querySelector(".favorite-btn");

  // Load initial state from localStorage
  const bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "[]");
  const favorites = JSON.parse(localStorage.getItem("favorites") || "[]");

  if (bookmarks.includes(title)) bookmarkBtn.classList.add("bookmarked");
  if (favorites.includes(title)) favoriteBtn.classList.add("favorited");

  bookmarkBtn.addEventListener("click", () => {
    let bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "[]");
    if (bookmarks.includes(title)) {
      bookmarks = bookmarks.filter(t => t !== title);
      bookmarkBtn.classList.remove("bookmarked");
    } else {
      bookmarks.push(title);
      bookmarkBtn.classList.add("bookmarked");
    }
    localStorage.setItem("bookmarks", JSON.stringify(bookmarks));
  });

  favoriteBtn.addEventListener("click", () => {
    let favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
    if (favorites.includes(title)) {
      favorites = favorites.filter(t => t !== title);
      favoriteBtn.classList.remove("favorited");
    } else {
      favorites.push(title);
      favoriteBtn.classList.add("favorited");
    }
    localStorage.setItem("favorites", JSON.stringify(favorites));
  });
});





