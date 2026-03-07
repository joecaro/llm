const livekitOutboundCallEdges = [
  // LiveKitOutboundCall internal connections
  { id: "e1", source: "run_voice_pipeline_agent", target: "GraphManager", animated: true },
  { id: "e2", source: "run_voice_pipeline_agent", target: "shutdown_hook", animated: true },
  { id: "e3", source: "run_voice_pipeline_agent", target: "coalesce_livekit_messages", animated: true },
  { id: "e4", source: "run_voice_pipeline_agent", target: "print_history", animated: true },
  { id: "e5", source: "run_voice_pipeline_agent", target: "get_post_call_processor", animated: true },

  // GraphManager connections
  { id: "e6", source: "GraphManager", target: "reinitialize_graph", animated: true },
  { id: "e7", source: "reinitialize_graph", target: "langgraph_agent", animated: true },
  
  // LangGraph to VoicePipelineAgent
  { id: "e8", source: "langgraph_agent", target: "agent_instance", animated: true },

  // LiveKitCallStatusManager flow
  { id: "e9", source: "manage_call", target: "update_call_state", animated: true },
  { id: "e10", source: "update_call_state", target: "sleep_state", animated: true },
];

export default livekitOutboundCallEdges;