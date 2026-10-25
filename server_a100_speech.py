import os
import sys
import io
import time
import asyncio
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from faster_whisper import WhisperModel
from pycloudflared import try_cloudflare

print("=" * 60)
print("🚀 INITIALIZING A100 HIGH-PERFORMANCE SPEECH ENGINE")
print("=" * 60)

# Load Whisper Large-v3 in full FP16 on NVIDIA A100
start_load = time.time()
model_size = "large-v3"
print(f"[A100 GPU] Loading {model_size} with CTranslate2 in float16...")
model = WhisperModel(model_size, device="cuda", compute_type="float16")
print(f"[A100 GPU] Model ready in {time.time() - start_load:.2f}s!")

app = FastAPI(title="A100 Speech & Interaction Arbiter")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def parse_intent(text: str):
    text = text.lower().strip()
    intent = "NONE"
    
    if any(k in text for k in ["piano mode", "start piano", "activate piano", "deschide pianul", "porneste pianul", "play piano"]):
        intent = "ACTIVATE_PIANO"
    elif any(k in text for k in ["stop piano", "close piano", "exit piano", "opreste pianul", "inchide pianul", "stop", "exit"]):
        intent = "STOP_PIANO"
    elif any(k in text for k in ["reset", "reseteaza", "recenter", "calibreaza"]):
        intent = "RESET_POSE"

    return intent

@app.get("/")
def health_check():
    return {"status": "online", "accelerator": "NVIDIA A100-40GB", "engine": "Faster-Whisper Large-v3"}

@app.post("/ping_payload")
async def ping_payload(request: Request):
    body = await request.body()
    return {"status": "ok", "received_bytes": len(body), "timestamp": time.time()}

@app.post("/transcribe_audio")
async def transcribe_audio(request: Request):
    audio_bytes = await request.body()
    start = time.perf_counter()
    
    audio_stream = io.BytesIO(audio_bytes)
    segments, info = model.transcribe(audio_stream, beam_size=1, language="en", vad_filter=True)
    
    transcript = " ".join([seg.text for seg in segments]).strip()
    inference_time = (time.perf_counter() - start) * 1000.0
    intent = parse_intent(transcript)
    
    return {
        "transcript": transcript,
        "intent": intent,
        "inference_ms": round(inference_time, 1),
        "language": info.language,
        "language_probability": round(info.language_probability, 2)
    }

@app.websocket("/ws_speech")
async def websocket_speech(websocket: WebSocket):
    await websocket.accept()
    print("[WebSocket] Antigravity IDE connected to A100 speech stream.")
    try:
        while True:
            audio_chunk = await websocket.receive_bytes()
            if len(audio_chunk) < 1000:
                continue
                
            start = time.perf_counter()
            audio_stream = io.BytesIO(audio_chunk)
            segments, info = model.transcribe(audio_stream, beam_size=1, vad_filter=True)
            transcript = " ".join([seg.text for seg in segments]).strip()
            inference_ms = (time.perf_counter() - start) * 1000.0
            
            if transcript:
                intent = parse_intent(transcript)
                await websocket.send_json({
                    "transcript": transcript,
                    "intent": intent,
                    "inference_ms": round(inference_ms, 1)
                })
    except WebSocketDisconnect:
        print("[WebSocket] Client disconnected.")

if __name__ == "__main__":
    # Expose via free Cloudflare Tunnel
    port = 8000
    tunnel = try_cloudflare(port=port)
    url_str = str(tunnel)
    print("=" * 60)
    print(f"🌐 PUBLIC A100 ENDPOINT: {url_str}")
    print("=" * 60)
    sys.stdout.flush()

    with open("/content/a100_tunnel_url.txt", "w") as f:
        f.write(url_str)

    uvicorn.run(app, host="0.0.0.0", port=port)
