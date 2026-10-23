# Gateway / Router layer for Open Jules
# Compatible with LiteLLM, Portkey Gateway, Bifrost, FreeLLMAPI, etc.
# From CodesbyFebin/Open-Source-Ai-Full-Stack catalog

# Recommended: LiteLLM proxy (broadest coverage)
# pip install 'litellm[proxy]'
# litellm --config litellm-config.yaml --port 4000

# Or Portkey Gateway / Bifrost for lower latency.

# Point Open Jules or any OpenAI SDK at:
# OPENAI_BASE_URL=http://localhost:4000/v1
# OPENAI_API_KEY=sk-...

# Example litellm-config.yaml snippet:
model_list:
  - model_name: jules-router
    litellm_params:
      model: gemini/gemini-2.5-pro
      api_key: os.environ/GEMINI_API_KEY
  - model_name: local
    litellm_params:
      model: ollama/qwen2.5-coder
      api_base: http://localhost:11434

# JEV can sit in front for typed decision routing before calling the gateway.
