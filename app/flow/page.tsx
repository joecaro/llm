import Container from '@/components/flow/container'
import { ReactFlowProvider } from '@xyflow/react';

export default function FlowPage() {
  return (
    <ReactFlowProvider>
      <Container />
    </ReactFlowProvider>
  );
}
