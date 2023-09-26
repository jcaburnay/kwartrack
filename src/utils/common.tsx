import { rpc } from "@/app/rpc_client";
import { textPropDefs } from "@radix-ui/themes";
import { UseQueryResult, QueryClient, QueryKey } from "@tanstack/react-query";
import { ReactHTML, useMemo } from "react";

export type Unpacked<T> = T extends (infer U)[] ? U : T;

export function groupBy<T, K extends string>(
  items: T[],
  key: (item: T) => K
): Record<K, T[]> {
  const result = {} as Record<K, T[]>;
  for (const item of items) {
    const k = key(item);
    if (k in result) {
      result[k].push(item);
    } else {
      result[k] = [item];
    }
  }
  return result;
}

const nf = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export function formatValue(value: number) {
  return nf.format(value);
}

export function QueryResult<T>(props: {
  as?: keyof ReactHTML;
  className?: string;
  query: UseQueryResult<T>;
  children: (data: NonNullable<T>) => React.ReactNode;
  onLoading?: React.ReactNode;
  onUndefined?: React.ReactNode;
  onError?: (error: Error) => React.ReactNode;
}) {
  const { data, isLoading, isError } = props.query;
  const { as: Tag } = props;
  let node: React.ReactNode;
  if (isLoading) {
    node = props.onLoading;
  } else if (isError) {
    node = props.onError ? props.onError(props.query.error as Error) : null;
  } else if (!data) {
    node = props.onUndefined;
  } else {
    node = props.children(data);
  }
  if (Tag === undefined) return <>{node}</>;
  return <Tag className={props.className}>{node}</Tag>;
}

export type Partitions = Awaited<
  ReturnType<typeof rpc.post.getPartitionOptions>
>;
export type PartitionOption = Unpacked<NonNullable<Partitions>>;

export function getPartitionType(
  p: PartitionOption,
  userId: string
): "owned" | "common" | "others" {
  if (p.account.owners.length === 1 && p.account.owners[0].id === userId) {
    return "owned";
  } else if (
    p.account.owners.length > 1 &&
    p.account.owners.map((o) => o.id).includes(userId)
  ) {
    return "common";
  }
  return "others";
}

export const CATEGORY_COLOR = {
  Income: "green",
  Expense: "red",
  Transfer: "blue",
} as const;

export const PARTITION_COLOR = {
  owned: "orange",
  common: "indigo",
  others: "gray",
} as const;

export type RadixColor =
  | (typeof textPropDefs)["color"]["values"][number]
  | undefined;

export type Categories = Awaited<ReturnType<typeof rpc.post.getUserCategories>>;
export type Category = Unpacked<Categories["Expense"]>;

export const getCategoryOptionName = (category: Category) => {
  return category.name;
};

export function invalidateMany(client: QueryClient, keys: QueryKey[]) {
  for (const key of keys) {
    client.invalidateQueries(key);
  }
}

export function useGroupedPartitions(partitions: Partitions, userId: string) {
  const sortedPartitions = useMemo(() => {
    const partitionsByType = groupBy(partitions, (p) =>
      getPartitionType(p, userId)
    );
    return [
      ...(partitionsByType.owned || []),
      ...(partitionsByType.common || []),
      ...(partitionsByType.others || []),
    ];
  }, [partitions, userId]);

  const groupedPartitions = useMemo(() => {
    return groupBy(sortedPartitions, (p) => p.account.id);
  }, [sortedPartitions]);

  return groupedPartitions;
}
