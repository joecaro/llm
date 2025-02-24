import { NodeProps, Node, Handle, Position } from "@xyflow/react";
import { BaseNode } from "../base-node";

export type FourHandleNode = Node<
  {
    label?: string;
  },
  "fourHandle"
>;

export default function FourHandleNode(props: NodeProps<FourHandleNode>) {
  return (
    <BaseNode>
      <Handle type="target" id={props.id + "-top"} position={Position.Top} />
      <Handle
        type="target"
        id={props.id + "-right"}
        position={Position.Right}
      />
      <Handle
        type="source"
        id={props.id + "-bottom"}
        position={Position.Bottom}
      />
      <Handle type="source" id={props.id + "-left"} position={Position.Left} />
      <p className="text-xs p-2">{props.data.label}</p>
    </BaseNode>
  );
}
