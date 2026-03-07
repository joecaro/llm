import telephonyOutbound from "./telephony_outbound";
import helpers from "./helpers";
import calls from "./calls";

import appConfig from "./app_config";
import clientDialer from "./client-dialer";
import baseDialer from "./base_dialer";
import outboundCallHandler from "./outbound-call-handler";
import livekitOutboundCall from "./livekit-outbound-call";
import workerOptions from "./worker-options";
import graphManager from "./graph-manager";
import langGraph from "./langgraph";
import voicePipelineAgent from "./voice-pipeline-agent";
import livekitCallStatusManager from "./livekit-call-status-manager";
import shutdownHook from "./shutdown-hook";
import livekitOutboundCallClass from "./livekit-outbound-call-class";
import runVoicePipeline from "./run-voice-pipeline";
import createExplicitDispatch from "./create-explicit-dispatch";
import clientPostCallProcessor from "./client-post-call-processor";

import { Node } from "@xyflow/react";

export default [
  ...telephonyOutbound,
  ...workerOptions,
  ...helpers,
  ...calls,
  ...appConfig,
  ...clientDialer,
  ...baseDialer,
  ...outboundCallHandler,
  ...livekitCallStatusManager,
  ...livekitOutboundCall,
  ...livekitOutboundCallClass,
  ...createExplicitDispatch,
  ...runVoicePipeline,
  ...graphManager,
  ...langGraph,
  ...voicePipelineAgent,
  ...shutdownHook,
  ...clientPostCallProcessor,
] as Node[];
