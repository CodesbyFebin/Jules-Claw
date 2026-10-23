# Memory layer for Open Jules
# Recommended from CodesbyFebin/Open-Source-Ai-Full-Stack:
# - Mem0 (universal extract-and-retrieve)
# - Letta (stateful agents with self-editing memory)
# - OpenMemory (MCP memory server)
# - Graphiti (temporal knowledge graph)

# Quick Mem0 example (point at your gateway):
# pip install mem0ai
# from mem0 import Memory
# m = Memory()
# m.add("User prefers TypeScript and dark themes", user_id="febin")
# results = m.search("preferences", user_id="febin")

# Open Jules stores session metadata in the Jules API.
# For persistent cross-session memory, wire Mem0 or Letta into the backend
# and inject relevant memories into the prompt before creating a Jules session.
