import { NodeProps, Node } from "@xyflow/react";

export type CounterNode = Node<
  {
    label?: string;
  },
  "group"
>;

export default function CounterNode(props: NodeProps<CounterNode>) {
  return (
    <>
      <p className="text-xs font-bold text-gray-500 p-2">{props.data.label}</p>
    </>
  );
}
