"""
Reference AWS Lambda handler for the embedding endpoint.

Contract (matches the frontend in embeddings.js):
  Request  (POST, JSON body):  { "text": "some text" }
  Response (JSON body):        { "embedding": [ ...384 floats... ] }

CORS is configured at the infrastructure layer (Terraform / Function URL),
so it is intentionally not handled in code here.

Model: sentence-transformers/all-MiniLM-L6-v2 (384 dims), loaded once at cold
start (module scope) so warm invocations stay fast. The client computes true
cosine similarity (it divides by the norms), so normalization here is optional
and only a minor convenience.
"""

import json

# Loaded once per container, reused across warm invocations.
MODEL = ...


def encode(text):
    return MODEL.encode(text, normalize_embeddings=True)


def handler(event, context):
    raw = event.get("body")
    if raw is None:
        return {"statusCode": 400, "body": json.dumps({"error": "missing body"})}
    try:
        body = json.loads(raw)
    except json.JSONDecodeError:
        return {"statusCode": 400, "body": json.dumps({"error": "invalid JSON"})}
    text = body.get("text", "")
    embedding = encode(text)
    return {"statusCode": 200, "body": json.dumps({"embedding": embedding.tolist()})}