"use strict";

/* =========================
   DOM 요소 선택
========================= */

const mainNav = document.querySelector(".main-nav");
const mobileMenuButton = document.querySelector(".mobile-menu-button");
const navLinks = document.querySelectorAll(".nav-link");
const goRecommendButton = document.querySelector(".go-recommend-button");

const recommendForm = document.querySelector("#recommend-form");
const recommendButton = document.querySelector("#recommend-button");

const ingredientsInput = document.querySelector("#ingredients");
const servingsInput = document.querySelector("#servings");
const cuisineInput = document.querySelector("#cuisine");
const cookingTimeInput = document.querySelector("#cooking-time");
const preferenceInput = document.querySelector("#preference");

const resultEmpty = document.querySelector("#result-empty");
const resultLoading = document.querySelector("#result-loading");
const resultError = document.querySelector("#result-error");
const resultContent = document.querySelector("#result-content");
const errorMessage = document.querySelector("#error-message");

const dishName = document.querySelector("#dish-name");
const dishDescription = document.querySelector("#dish-description");
const cookingTimeResult = document.querySelector("#cooking-time-result");
const difficultyResult = document.querySelector("#difficulty-result");
const ingredientsResult = document.querySelector("#ingredients-result");
const stepsResult = document.querySelector("#steps-result");
const tipResult = document.querySelector("#tip-result");

/* =========================
   공통 함수
========================= */

/**
 * 결과 영역의 상태를 변경합니다.
 *
 * @param {"empty"|"loading"|"error"|"content"} state
 */
function showResultState(state) {
  resultEmpty.classList.toggle("hidden", state !== "empty");
  resultLoading.classList.toggle("hidden", state !== "loading");
  resultError.classList.toggle("hidden", state !== "error");
  resultContent.classList.toggle("hidden", state !== "content");
}

/**
 * 오류 메시지를 표시합니다.
 *
 * @param {string} message
 */
function showError(message) {
  errorMessage.textContent = message;
  showResultState("error");
}

/**
 * 모바일 메뉴를 닫습니다.
 */
function closeMobileMenu() {
  if (!mainNav || !mobileMenuButton) {
    return;
  }

  mainNav.classList.remove("is-open");
  mobileMenuButton.setAttribute("aria-expanded", "false");
  mobileMenuButton.setAttribute("aria-label", "메뉴 열기");
}

/**
 * 선택된 네비게이션 메뉴를 활성화합니다.
 *
 * @param {string} targetId
 */
function setActiveNavLink(targetId) {
  navLinks.forEach((link) => {
    const isActive = link.getAttribute("href") === `#${targetId}`;
    link.classList.toggle("active", isActive);
  });
}

/**
 * AI 응답의 배열 데이터를 안전하게 배열로 변환합니다.
 *
 * @param {unknown} value
 * @returns {Array}
 */
function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    return value
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

/* =========================
   네비게이션
========================= */

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    const targetId = link.getAttribute("href").replace("#", "");

    setActiveNavLink(targetId);
    closeMobileMenu();
  });
});

if (goRecommendButton) {
  goRecommendButton.addEventListener("click", () => {
    const recommendSection = document.querySelector("#recommend");

    if (recommendSection) {
      recommendSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    setActiveNavLink("recommend");
  });
}

if (mobileMenuButton) {
  mobileMenuButton.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("is-open");

    mobileMenuButton.setAttribute("aria-expanded", String(isOpen));
    mobileMenuButton.setAttribute(
      "aria-label",
      isOpen ? "메뉴 닫기" : "메뉴 열기"
    );
  });
}

document.addEventListener("click", (event) => {
  if (!mainNav || !mobileMenuButton) {
    return;
  }

  const clickedInsideMenu =
    mainNav.contains(event.target) ||
    mobileMenuButton.contains(event.target);

  if (!clickedInsideMenu) {
    closeMobileMenu();
  }
});

/* =========================
   스크롤에 따른 메뉴 활성화
========================= */

const sections = document.querySelectorAll("main section[id]");

const sectionObserver = new IntersectionObserver(
  (entries) => {
    const visibleSection = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (visibleSection) {
      setActiveNavLink(visibleSection.target.id);
    }
  },
  {
    root: null,
    rootMargin: "-20% 0px -60% 0px",
    threshold: [0.1, 0.25, 0.5]
  }
);

sections.forEach((section) => {
  sectionObserver.observe(section);
});

/* =========================
   AI 추천 결과 출력
========================= */

/**
 * AI 추천 결과를 화면에 출력합니다.
 *
 * @param {Object} result
 */
function renderRecommendation(result) {
  const ingredients = normalizeArray(result.ingredients);
  const steps = normalizeArray(result.steps);

  dishName.textContent = result.dish_name || "추천 요리";
  dishDescription.textContent =
    result.description || "입력한 재료를 활용한 맞춤 요리입니다.";
  cookingTimeResult.textContent = result.cooking_time || "정보 없음";
  difficultyResult.textContent = result.difficulty || "정보 없음";
  tipResult.textContent =
    result.tip || "보유한 재료에 따라 재료의 양을 조절해주세요.";

  ingredientsResult.innerHTML = "";

  if (ingredients.length === 0) {
    const emptyIngredientItem = document.createElement("li");
    emptyIngredientItem.textContent = "재료 정보가 없습니다.";
    ingredientsResult.appendChild(emptyIngredientItem);
  } else {
    ingredients.forEach((ingredient) => {
      const ingredientItem = document.createElement("li");
      ingredientItem.textContent = ingredient;
      ingredientsResult.appendChild(ingredientItem);
    });
  }

  stepsResult.innerHTML = "";

  if (steps.length === 0) {
    const emptyStepItem = document.createElement("li");
    emptyStepItem.textContent = "조리 방법 정보가 없습니다.";
    stepsResult.appendChild(emptyStepItem);
  } else {
    steps.forEach((step) => {
      const stepItem = document.createElement("li");
      stepItem.textContent = step;
      stepsResult.appendChild(stepItem);
    });
  }

  showResultState("content");
}

/* =========================
   AI 추천 API 요청
========================= */

if (recommendForm) {
  recommendForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const ingredients = ingredientsInput.value.trim();
    const servings = servingsInput.value;
    const cuisine = cuisineInput.value;
    const cookingTime = cookingTimeInput.value;
    const preference = preferenceInput.value.trim();

    /*
     * 필수 입력값 검사
     */
    if (!ingredients) {
      showError("재료를 한 가지 이상 입력해주세요.");
      ingredientsInput.focus();
      return;
    }

    if (!servings) {
      showError("식사 인원을 선택해주세요.");
      servingsInput.focus();
      return;
    }

    const requestData = {
      ingredients,
      servings,
      cuisine,
      cookingTime,
      preference
    };

    /*
     * 로딩 상태 표시
     */
    showResultState("loading");
    recommendButton.disabled = true;
    recommendButton.setAttribute("aria-busy", "true");

    /*
     * 20초 타임아웃 설정
     */
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 60000);

    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      let responseData;

      try {
        responseData = await response.json();
      } catch (parseError) {
        throw new Error("서버 응답을 읽을 수 없습니다.");
      }

      if (!response.ok) {
        throw new Error(
          responseData.error ||
            "요리 추천을 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
        );
      }

      if (!responseData.result) {
        throw new Error("AI 추천 결과가 비어 있습니다.");
      }

      renderRecommendation(responseData.result);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        showError(
          "응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요."
        );
      } else {
        console.error("AI 추천 요청 오류:", error);
        showError(
          error.message ||
            "요리 추천을 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
        );
      }
    } finally {
      recommendButton.disabled = false;
      recommendButton.removeAttribute("aria-busy");
    }
  });
}
