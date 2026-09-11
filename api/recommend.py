import json
import os
from http.server import BaseHTTPRequestHandler

from google import genai
from google.genai import types


MODEL_NAME = "gemini-3.6-flash"


RECIPE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "dish_name": {
            "type": "STRING",
            "description": "추천 요리 이름"
        },
        "description": {
            "type": "STRING",
            "description": "추천 요리에 대한 짧은 설명"
        },
        "cooking_time": {
            "type": "STRING",
            "description": "예상 조리 시간"
        },
        "difficulty": {
            "type": "STRING",
            "description": "요리 난이도"
        },
        "ingredients": {
            "type": "ARRAY",
            "items": {
                "type": "STRING"
            },
            "description": "필요한 재료와 양"
        },
        "steps": {
            "type": "ARRAY",
            "items": {
                "type": "STRING"
            },
            "description": "순서대로 정리한 조리 방법"
        },
        "tip": {
            "type": "STRING",
            "description": "요리 팁 또는 대체 재료 정보"
        }
    },
    "required": [
        "dish_name",
        "description",
        "cooking_time",
        "difficulty",
        "ingredients",
        "steps",
        "tip"
    ]
}


def send_json(handler, status_code, data):
    """
    JSON 형식으로 응답을 반환합니다.
    """
    response_body = json.dumps(
        data,
        ensure_ascii=False
    ).encode("utf-8")

    handler.send_response(status_code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Content-Length", str(len(response_body)))
    handler.end_headers()
    handler.wfile.write(response_body)


def create_prompt(data):
    """
    사용자의 입력값을 Gemini에게 전달할 프롬프트로 변환합니다.
    """
    ingredients = data.get("ingredients", "").strip()
    servings = str(data.get("servings", "")).strip()
    cuisine = str(data.get("cuisine", "상관없음")).strip()
    cooking_time = str(data.get("cookingTime", "상관없음")).strip()
    preference = str(data.get("preference", "")).strip()

    return f"""
당신은 친절하고 실용적인 한국 요리 전문가입니다.

사용자가 가진 재료와 조건을 바탕으로 실제로 만들 수 있는 요리 1가지를 추천해주세요.

[사용자 입력]
- 보유 재료: {ingredients}
- 식사 인원: {servings}명
- 요리 장르: {cuisine}
- 원하는 조리 시간: {cooking_time}
- 추가 요청: {preference if preference else "없음"}

[추천 기준]
1. 사용자가 입력한 재료를 최대한 많이 활용하세요.
2. 부족한 재료가 있다면 필요한 추가 재료로 명확하게 표시하세요.
3. 사용자의 조리 시간과 식사 인원을 고려하세요.
4. 실제 초보자도 따라 할 수 있도록 조리 순서를 구체적으로 작성하세요.
5. 입력 재료로 만들기 어려운 요리를 억지로 추천하지 마세요.
6. 음식 알레르기나 안전과 관련된 내용은 주의사항에 간단히 표시하세요.
7. 응답은 반드시 지정된 JSON 형식으로만 작성하세요.
""".strip()


class handler(BaseHTTPRequestHandler):
    """
    Vercel Python Serverless Function의 진입점입니다.
    """

    def do_OPTIONS(self):
        """
        브라우저의 사전 요청을 처리합니다.
        """
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        """
        프론트엔드의 POST 요청을 처리합니다.
        """
        try:
            content_length = int(
                self.headers.get("Content-Length", 0)
            )

            if content_length <= 0:
                send_json(
                    self,
                    400,
                    {
                        "error": "요청 데이터가 없습니다."
                    }
                )
                return

            request_body = self.rfile.read(content_length)

            try:
                data = json.loads(request_body.decode("utf-8"))
            except json.JSONDecodeError:
                send_json(
                    self,
                    400,
                    {
                        "error": "요청 형식이 올바르지 않습니다."
                    }
                )
                return

            ingredients = str(
                data.get("ingredients", "")
            ).strip()

            servings = str(
                data.get("servings", "")
            ).strip()

            if not ingredients:
                send_json(
                    self,
                    400,
                    {
                        "error": "재료를 한 가지 이상 입력해주세요."
                    }
                )
                return

            if not servings:
                send_json(
                    self,
                    400,
                    {
                        "error": "식사 인원을 선택해주세요."
                    }
                )
                return

            api_key = os.environ.get("GEMINI_API_KEY")

            if not api_key:
                send_json(
                    self,
                    500,
                    {
                        "error": "Gemini API 키가 서버에 설정되지 않았습니다."
                    }
                )
                return

            client = genai.Client(api_key=api_key)

            prompt = create_prompt(data)

            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.7,
                    response_mime_type="application/json",
                    response_schema=RECIPE_SCHEMA
                )
            )

            response_text = response.text

            if not response_text:
                send_json(
                    self,
                    502,
                    {
                        "error": "AI가 빈 응답을 반환했습니다."
                    }
                )
                return

            try:
                recipe_result = json.loads(response_text)
            except json.JSONDecodeError:
                send_json(
                    self,
                    502,
                    {
                        "error": "AI 응답을 JSON으로 변환하지 못했습니다."
                    }
                )
                return

            send_json(
                self,
                200,
                {
                    "result": recipe_result
                }
            )

        except Exception as error:
            print("Gemini API 오류:", error)

            send_json(
                self,
                500,
                {
                    "error": (
                        "요리 추천을 처리하는 중 오류가 발생했습니다. "
                        "잠시 후 다시 시도해주세요."
                    )
                }
            )
