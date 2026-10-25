"""
Latency Benchmark & Connection Quality Diagnostic Probe
Measures real-world video and landmark payload round-trip time (RTT) and jitter
between local Antigravity IDE and Google Colab A100 GPU server.
"""

import sys
import time
import requests
import numpy as np

def run_benchmark(endpoint_url="http://localhost:8000/ping_payload", num_samples=30):
    print("=" * 65)
    print("[BENCHMARK] REAL-TIME PIPELINE LATENCY PROBE: CLIENT -> SERVER")
    print(f"Target Endpoint : {endpoint_url}")
    print(f"Sample Count    : {num_samples} frames (Simulating 30-60 FPS)")
    print("=" * 65)

    # 50 KB simulates an optimized JPEG/WebP compressed 720p camera frame
    test_frame_bytes = np.random.bytes(50 * 1024)
    rtt_times = []

    for i in range(num_samples):
        start = time.perf_counter()
        try:
            res = requests.post(
                endpoint_url,
                data=test_frame_bytes,
                headers={"Content-Type": "application/octet-stream"},
                timeout=3.0
            )
            rtt = (time.perf_counter() - start) * 1000.0
            if res.status_code == 200:
                rtt_times.append(rtt)
                sys.stdout.write(f"\r[Frame {i+1:02d}/{num_samples}] RTT: {rtt:6.1f} ms")
                sys.stdout.flush()
        except requests.exceptions.RequestException as e:
            sys.stdout.write(f"\r[Frame {i+1:02d}/{num_samples}] Packet Dropped / Timeout\n")
            sys.stdout.flush()

        time.sleep(0.016)  # 60 FPS interval

    print("\n" + "=" * 65)
    print("[DIAGNOSTIC REPORT] BENCHMARK VERDICT")
    print("=" * 65)

    if not rtt_times:
        print("[FAIL] Unable to reach endpoint. Verify server/tunnel is active.")
        return

    avg_rtt = np.mean(rtt_times)
    min_rtt = np.min(rtt_times)
    max_rtt = np.max(rtt_times)
    jitter = np.std(rtt_times)

    print(f"Average Payload RTT : {avg_rtt:.2f} ms")
    print(f"Minimum RTT         : {min_rtt:.2f} ms")
    print(f"Maximum RTT         : {max_rtt:.2f} ms")
    print(f"Network Jitter (SD) : {jitter:.2f} ms")
    print("-" * 65)

    if avg_rtt < 50.0 and jitter < 12.0:
        print("[GRADE A] EXCELLENT: Network latency is under 50ms.")
        print("   Video frames can stream directly to Colab A100 for remote GPU inference.")
    elif avg_rtt < 120.0:
        print("[GRADE B] OPTIMAL FOR OPTION A: Ideal for cloud speech & audio (Whisper Large-v3 on A100).")
        print("   Local WASM provides instant 60 FPS mirror tracking while A100 processes voice commands.")
    else:
        print("[GRADE C] HIGH LATENCY: Round-trip exceeds 120ms.")
        print("   Recommended: Full local edge tracking via WebAssembly.")
    print("=" * 65)

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000/ping_payload"
    run_benchmark(url)
