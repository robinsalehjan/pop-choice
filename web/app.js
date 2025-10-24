/**
 * PopChoice - Movie Recommendation App
 * Handles form validation, API calls, and UI transitions
 */

// API Endpoints
const API_ENDPOINTS = {
    embedding: 'https://openai-pop-choice-embedding-worker.r-salehjan.workers.dev',
    recommendation: 'https://supabase-pop-choice-worker.r-salehjan.workers.dev'
};

// Form field configuration
const FORM_FIELDS = ['favoriteMovie', 'movieEra', 'movieType'];

// Transition timing
const TRANSITION_DURATION = 300;
const TOAST_DURATION = 3000;
const TOAST_DELAY = 100;

// DOM Elements Cache
const elements = {
    form: null,
    questionPage: null,
    resultPage: null,
    loading: null,
    errorToast: null,
    movieTitle: null,
    movieDescription: null,
    submitButton: null,
    goAgainButton: null
};

/**
 * Initialize the application
 */
function init() {
    cacheElements();
    attachEventListeners();
}

/**
 * Cache DOM elements for performance
 */
function cacheElements() {
    elements.form = document.getElementById('moviePreferencesForm');
    elements.questionPage = document.getElementById('questionPage');
    elements.resultPage = document.getElementById('resultPage');
    elements.loading = document.getElementById('loading');
    elements.errorToast = document.getElementById('errorToast');
    elements.movieTitle = document.getElementById('movieTitle');
    elements.movieDescription = document.getElementById('movieDescription');
    elements.submitButton = document.getElementById('submitButton');
    elements.goAgainButton = document.getElementById('goAgainButton');
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
    elements.form.addEventListener('submit', handleFormSubmit);
    elements.goAgainButton.addEventListener('click', handleGoAgain);

    // Clear error messages on input
    FORM_FIELDS.forEach(field => {
        const input = document.getElementById(field);
        input.addEventListener('input', () => clearError(field));
    });
}

/**
 * Handle form submission
 * @param {Event} event - Submit event
 */
async function handleFormSubmit(event) {
    event.preventDefault();

    if (!validateForm()) {
        return;
    }

    await fetchMovieRecommendation();
}

/**
 * Validate all form fields
 * @returns {boolean} - Whether the form is valid
 */
function validateForm() {
    let isValid = true;

    FORM_FIELDS.forEach(field => {
        const input = document.getElementById(field);
        const value = input.value.trim();
        const hasError = !value;

        showError(field, hasError);

        if (hasError) {
            isValid = false;
        }
    });

    return isValid;
}

/**
 * Show or hide error message for a field
 * @param {string} inputId - Field ID
 * @param {boolean} show - Whether to show error
 */
function showError(inputId, show) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(`${inputId}Error`);

    if (show) {
        input.classList.add('error');
        input.setAttribute('aria-invalid', 'true');
        error.classList.add('visible');
    } else {
        input.classList.remove('error');
        input.setAttribute('aria-invalid', 'false');
        error.classList.remove('visible');
    }
}

/**
 * Clear error for a specific field
 * @param {string} inputId - Field ID
 */
function clearError(inputId) {
    showError(inputId, false);
}

/**
 * Show error toast notification
 * @param {string} message - Error message to display
 */
function showErrorToast(message = 'Something went wrong. Please try again.') {
    const messageElement = document.getElementById('errorMessage');
    messageElement.textContent = message;

    setTimeout(() => {
        elements.errorToast.classList.add('visible');
        setTimeout(() => {
            elements.errorToast.classList.remove('visible');
        }, TOAST_DURATION);
    }, TOAST_DELAY);
}

/**
 * Get form data as an object
 * @returns {Object} - Form data
 */
function getFormData() {
    return FORM_FIELDS.reduce((data, field) => {
        data[field] = document.getElementById(field).value.trim();
        return data;
    }, {});
}

/**
 * Reset form fields
 */
function resetForm() {
    FORM_FIELDS.forEach(field => {
        const input = document.getElementById(field);
        input.value = '';
        clearError(field);
    });
}

/**
 * Reset result page content
 */
function resetResultPage() {
    elements.movieTitle.textContent = '';
    elements.movieDescription.textContent = '';
}

/**
 * Transition to loading state
 */
function showLoading() {
    elements.questionPage.style.opacity = '0';
    elements.questionPage.style.visibility = 'hidden';

    setTimeout(() => {
        elements.questionPage.classList.remove('active');
        elements.loading.style.display = 'flex';
    }, TRANSITION_DURATION);
}

/**
 * Transition to result page
 */
function showResultPage() {
    elements.loading.style.display = 'none';
    elements.resultPage.classList.add('active');
    elements.resultPage.style.opacity = '1';
    elements.resultPage.style.visibility = 'visible';
}

/**
 * Transition back to question page
 */
function showQuestionPage() {
    elements.resultPage.style.opacity = '0';
    elements.resultPage.style.visibility = 'hidden';

    setTimeout(() => {
        elements.resultPage.classList.remove('active');
        elements.questionPage.classList.add('active');
        elements.questionPage.style.opacity = '1';
        elements.questionPage.style.visibility = 'visible';
    }, TRANSITION_DURATION);
}

/**
 * Update result page with movie data
 * @param {Object} data - Movie recommendation data
 */
function updateResultPage(data) {
    elements.movieTitle.textContent = 'Recommended movies';
    elements.movieDescription.textContent = data.content;
}

/**
 * Fetch movie recommendation from APIs
 */
async function fetchMovieRecommendation() {
    showLoading();

    try {
        const formData = getFormData();
        const query = `${formData.favoriteMovie}, ${formData.movieEra}, ${formData.movieType}`;

        // Get embedding
        const embedding = await fetchEmbedding(query);

        // Get recommendation
        const recommendation = await fetchRecommendation(embedding);

        // Update UI with result
        updateResultPage(recommendation);
        showResultPage();

    } catch (error) {
        console.error('Error fetching movie recommendation:', error);
        handleFetchError();
    }
}

/**
 * Fetch embedding from OpenAI worker
 * @param {string} query - User query
 * @returns {Promise<Array>} - Embedding array
 */
async function fetchEmbedding(query) {
    const response = await fetch(API_ENDPOINTS.embedding, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
    });

    if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status}`);
    }

    const data = await response.json();
    return data.embedding;
}

/**
 * Fetch recommendation from Supabase worker
 * @param {Array} embedding - Embedding array
 * @returns {Promise<Object>} - Recommendation data
 */
async function fetchRecommendation(embedding) {
    const response = await fetch(API_ENDPOINTS.recommendation, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(embedding)
    });

    if (!response.ok) {
        throw new Error(`Recommendation API error: ${response.status}`);
    }

    return await response.json();
}

/**
 * Handle fetch errors
 */
function handleFetchError() {
    showErrorToast('Something went wrong. Please try again.');
    elements.loading.style.display = 'none';
    elements.questionPage.style.opacity = '1';
    elements.questionPage.style.visibility = 'visible';
    elements.questionPage.classList.add('active');
    resetForm();
}

/**
 * Handle "Go Again" button click
 */
function handleGoAgain() {
    resetForm();
    resetResultPage();
    showQuestionPage();
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
