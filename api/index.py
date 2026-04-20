import json
import os
import requests
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase Admin
firebase_sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
if firebase_sa_json:
    try:
        cert_dict = json.loads(firebase_sa_json)
        cred = credentials.Certificate(cert_dict)
        firebase_admin.initialize_app(cred)
    except Exception as e:
        print(f"Error loading Firebase Credentials from env: {e}")
        firebase_admin.initialize_app()
else:
    # Fallback to default credentials (for local dev if configured)
    try:
        firebase_admin.initialize_app()
    except ValueError:
        pass # Already initialized or missing credentials

db = firestore.client()

app = FastAPI()

# Enable CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, you can replace "*" with your actual frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- MCQ EVALUATION ----------------
def evaluate_mcq(answers):
    correct = ['b','b','c','d','a','b','c','a','d','b','c']
    score = 0
    for i in range(min(len(answers), len(correct))):
        if str(answers[i]).lower() == correct[i]:
            score += 1
    return score

# ---------------- PAIRED EVALUATION ----------------
def evaluate_paired(answers):
    correct = [
        "A","A","B","B","A","B","A","B",
        "B","A","B","A","A","B","B","A",
        "B","A","B","A","A","A","B","A",
        "B","A","B","A","B","A","B","A"
    ]
    score = 0
    for i in range(min(len(answers), len(correct))):
        if str(answers[i]).upper() == correct[i]:
            score += 1
    return score

# ---------------- DEEPSEEK ----------------
def call_deepseek(prompt):
    api_key = os.environ.get("DEEPSEEK_API_KEY", "sk-aee4748505a344689e59b5f8d0fc4f48") # Used hardcoded key as fallback
    try:
        url = "https://api.deepseek.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        data = {
            "model": "deepseek-chat",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3
        }
        response = requests.post(url, headers=headers, json=data, timeout=30)
        result = response.json()
        if "choices" not in result:
            return json.dumps({"total": 0})
        return result["choices"][0]["message"]["content"]
    except Exception as e:
        print("DeepSeek Error:", e)
        return json.dumps({"total": 0})

def clean_json(text):
    try:
        text = text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except:
        return {"total": 0}

def evaluate_who(essay):
    if not essay or len(essay) < 10:
        return {"total": 0}
    prompt = f"""
    Evaluate Who Am I:
    {essay}
    Based on Initiative, Problem Solving, Goal Clarity, Resource Awareness.
    Return JSON: {{"initiative":0/1, "problem_solving":0/1, "goal_clarity":0/1, "resource_awareness":0/1, "total":0-4}}
    """
    return clean_json(call_deepseek(prompt))

def evaluate_image(story):
    if not story or len(story) < 10:
        return {"total": 0}
    prompt = f"""
    Evaluate Achievement Motivation Story:
    {story}
    Return JSON: {{"total":0-11}}
    """
    return clean_json(call_deepseek(prompt))

@app.post("/api/submit_test")
async def submit_test(request: Request):
    try:
        data = await request.json()
        user_id = data.get("user_id")
        
        mcq_score = evaluate_mcq(data.get("section1", []))
        paired_score = evaluate_paired(data.get("section2", []))
        who = evaluate_who(data.get("who_am_i", ""))
        
        images_data = data.get("images", [])
        images_results = [evaluate_image(img) for img in images_data]
        
        total = mcq_score + paired_score + who.get("total", 0) + sum(i.get("total", 0) for i in images_results)
        
        # Save to Firestore
        db.collection("results").add({
            "user_id": user_id,
            "section1": data.get("section1", []),
            "section2": data.get("section2", []),
            "who_am_i": who,
            "images": images_results,
            "total": total,
            "createdAt": firestore.SERVER_TIMESTAMP
        })
        
        return {
            "mcq_score": mcq_score,
            "paired_score": paired_score,
            "who_am_i": who,
            "images": images_results,
            "total": total
        }
    except Exception as e:
        print("Error submitting test", e)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/")
def read_root():
    return {"message": "EST Platform API is running"}
