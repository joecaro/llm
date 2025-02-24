import { Node } from "@xyflow/react";

export default [
  {
    id: "LiveKitOutboundCall_class",
    type: "groupNode",
    position: { x: 10, y: 30 },
    style: {
      width: 380,
      height: 750,
      backgroundColor: "rgba(255, 255, 255, 0.3)",
      borderRadius: "8px",
      border: "1px solid #ccc",
    },
    data: { label: "LiveKitOutboundCall" },
    parentId: "livekit_outbound_call_group",
  },
  {
    id: "entrypoint",
    position: { x: 20, y: 380 },
    data: { label: "entrypoint (on )" },
    parentId: "LiveKitOutboundCall_class",
  },
  {
    id: "setup_call_metadata",
    position: { x: 20, y: 430 },
    data: { label: "get_call_metadata (redis)" },
    parentId: "LiveKitOutboundCall_class",
  },
  {
    id: "get_post_call_processor",
    position: { x: 20, y: 500 },
    data: { label: "get_post_call_processor" },
    parentId: "LiveKitOutboundCall_class",
  },
  {
    id: "get_call_metadata",
    position: { x: 20, y: 550 },
    data: { label: "get_call_metadata" },
    parentId: "LiveKitOutboundCall_class",
  },
  {
    id: "create_sip_participant",
    position: { x: 20, y: 600 },
    data: { label: "create_sip_participant" },
    parentId: "LiveKitOutboundCall_class",
  },
  {
    id: "run_voice_pipeline_agent_call",
    position: { x: 210, y: 30 },
    data: { label: "run_voice_pipeline_a..." },
    style: {
      backgroundColor: "rgba(255, 230, 255, 0.3)",
      borderRadius: "8px",
      border: "1px solid #ce93d8",
    },
    parentId: "LiveKitOutboundCall_class",
  },
  {
    id: "LiveKitCallStatusManager",
    position: { x: 210, y: 300 },
    data: { label: "LiveKitCallStatusManager" },
    style: {
      backgroundColor: "rgba(255, 230, 255, 0.3)",
      borderRadius: "8px",
      border: "1px solid #ce93d8",
    },
    parentId: "LiveKitOutboundCall_class",
  },
  {
    id: "LiveKitCallStatusManager_manage",
    position: { x: 210, y: 360 },
    data: { label: "manage_call()" },
    style: {
      backgroundColor: "rgba(255, 230, 255, 0.3)",
      borderRadius: "8px",
      border: "1px solid #ce93d8",
    },
    parentId: "LiveKitOutboundCall_class",
  },
  {
    id: "shutdown_hook_call",
    position: { x: 210, y: 550 },
    data: { label: "shutdown_callback" },
    style: {
      backgroundColor: "rgba(255, 230, 255, 0.3)",
      borderRadius: "8px",
      border: "1px solid #ce93d8",
    },
    parentId: "LiveKitOutboundCall_class",
  },
  {
    id: "start_outbound_call",
    position: { x: 10, y: 40 },
    data: { label: "start" },
    parentId: "LiveKitOutboundCall_class",
  },
  {
    id: "call_config",
    position: { x: 10, y: 100 },
    data: { label: "CallConfig -> save_config (redis)" },
    parentId: "LiveKitOutboundCall_class",
  },
] as Node[];
