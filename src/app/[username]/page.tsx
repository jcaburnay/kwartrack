"use client";

import { ReactHTML, useContext, useState } from "react";
import { css } from "../../../styled-system/css";
import { rpc } from "../rpc_client";
import {
  type UseQueryResult,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { number, object, optional, string } from "valibot";
import { UserPageStoreProvider, UserPageStoreContext } from "./store";

export default function Main(props: { params: { username: string } }) {
  const { username } = props.params;
  return (
    <UserPageStoreProvider>
      <UserPage username={username} />
    </UserPageStoreProvider>
  );
}

export function UserPage({ username }: { username: string }) {
  const user = useQuery(["user", username], () => {
    return rpc.post.findUser({ username });
  });
  return (
    <QueryResult
      query={user}
      as="div"
      className={css({ display: "flex" })}
      onLoading={<>Loading {`${username}'s accounts`}...</>}
      onUndefined={<>{`${username}'s data`} not found</>}
    >
      {(user) => (
        <>
          <div
            className={css({
              padding: "10px",
              width: "1/3",
              minWidth: "250px",
              maxWidth: "300px",
            })}
          >
            <h1>{user.username}</h1>
            <Accounts userId={user.id} />
            <Categories userId={user.id} />
            <DateRange userId={user.id} />
          </div>
          <div>
            <TransactionForm user={user} />
            <Transactions userId={user.id} />
          </div>
        </>
      )}
    </QueryResult>
  );
}

function Accounts({ userId }: { userId: string }) {
  const [store] = useContext(UserPageStoreContext);
  const accounts = useQuery(["accounts", userId], () => {
    return rpc.post.getAccounts({ userId });
  });
  return (
    <QueryResult
      query={accounts}
      as="ul"
      onLoading={<>Loading accounts...</>}
      onUndefined={<>No accounts found</>}
    >
      {(accounts) =>
        accounts.map((account) => (
          <li
            key={account.id}
            className={css({
              marginBottom: "0.5rem",
              cursor: "pointer",
            })}
          >
            <div>
              {account.name} |
              <LoadingValue
                queryKey={[
                  "accountBalance",
                  {
                    accountId: account.id,
                    tssDate: store.tssDate,
                    tseDate: store.tseDate,
                  },
                ]}
                valueLoader={() =>
                  rpc.post.getAccountBalance({
                    accountId: account.id,
                    userId,
                    tssDate: store.tssDate?.toISOString(),
                    tseDate: store.tseDate?.toISOString(),
                  })
                }
              />
            </div>
            <Partitions accountId={account.id} userId={userId} />
          </li>
        ))
      }
    </QueryResult>
  );
}

function Partitions(props: { accountId: string; userId: string }) {
  const { accountId, userId } = props;
  const [store, dispatch] = useContext(UserPageStoreContext);
  const partitions = useQuery(["partitions", userId, accountId], () => {
    return rpc.post.getPartitions({ accountId, userId });
  });
  return (
    <QueryResult
      query={partitions}
      as="ul"
      className={css({ marginLeft: "1rem" })}
      onLoading={<>Loading partitions...</>}
      onUndefined={<>No partitions found</>}
    >
      {(partitions) => (
        <ul className={css({ paddingStart: "0.5rem" })}>
          {partitions.map((partition) => (
            <li
              key={partition.id}
              className={css({
                cursor: "pointer",
                color: store.partitionIds.includes(partition.id)
                  ? "blue"
                  : "inherit",
                textDecoration: partition.is_private ? "underline" : "inherit",
              })}
              onClick={(event) => {
                event.stopPropagation();
                dispatch({
                  type: "TOGGLE_PARTITIONS",
                  payload: [partition.id],
                });
              }}
            >
              {partition.name} |
              <LoadingValue
                queryKey={[
                  "partitionBalance",
                  {
                    partitionId: partition.id,
                    tssDate: store.tssDate,
                    tseDate: store.tseDate,
                  },
                ]}
                valueLoader={() =>
                  rpc.post.getPartitionBalance({
                    partitionId: partition.id,
                    userId,
                    tssDate: store.tssDate?.toISOString(),
                    tseDate: store.tseDate?.toISOString(),
                  })
                }
              />
            </li>
          ))}
        </ul>
      )}
    </QueryResult>
  );
}

function Categories({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const categories = useQuery(["categories", userId], () => {
    return rpc.post.getUserCategories({ userId });
  });
  return (
    <>
      <QueryResult
        query={categories}
        as="div"
        className={css({ padding: "1rem" })}
        onLoading={<>Loading categories...</>}
        onUndefined={<>No categories found</>}
      >
        {(categories) => (
          <ul>
            {categories.map((category) => (
              <Category key={category.id} category={category} userId={userId} />
            ))}
          </ul>
        )}
      </QueryResult>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const target = event.target as HTMLFormElement;
          const formdata = new FormData(target as HTMLFormElement);
          const formObj = Object.fromEntries(formdata.entries());
          const dataSchema = object({ name: string() });
          const parsedData = dataSchema.parse(formObj);
          await rpc.post.createUserCategory({
            userId,
            name: parsedData.name,
          });
          target.reset();
          queryClient.invalidateQueries({ queryKey: ["categories", userId] });
        }}
      >
        <label htmlFor="name">Category Name</label>
        <input type="text" name="name" />
        <input type="submit" value="Create"></input>
      </form>
    </>
  );
}

function Category({
  category,
  userId,
}: {
  category: { id: string; name: string };
  userId: string;
}) {
  const queryClient = useQueryClient();
  const [store, dispatch] = useContext(UserPageStoreContext);
  const [isDeleting, setIsDeleting] = useState(false);
  return (
    <li
      key={category.id}
      className={css({
        cursor: "pointer",
        color: store.categoryIds.includes(category.id) ? "blue" : "inherit",
        textDecoration: isDeleting ? "line-through" : "inherit",
      })}
      onClick={() => {
        dispatch({ type: "TOGGLE_CATEGORIES", payload: [category.id] });
      }}
    >
      {/* TODO: This delete button should be conditionally shown. Only categories without linked transactions can be deleted. */}
      <button
        onClick={async (event) => {
          event.stopPropagation();
          setIsDeleting(true);
          await rpc.post.deleteCategory({ categoryId: category.id });
          queryClient.invalidateQueries({ queryKey: ["categories", userId] });
        }}
      >
        x
      </button>{" "}
      | {category.name} |
      <LoadingValue
        queryKey={[
          "categoryBalance",
          {
            categoryId: category.id,
            tssDate: store.tssDate,
            tseDate: store.tseDate,
          },
        ]}
        valueLoader={() =>
          rpc.post.getCategoryBalance({
            userId,
            categoryId: category.id,
            tssDate: store.tssDate?.toISOString(),
            tseDate: store.tseDate?.toISOString(),
          })
        }
      />
    </li>
  );
}

function Transactions({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [store] = useContext(UserPageStoreContext);
  const [isDeleting, setIsDeleting] = useState(false);
  const transactions = useQuery(["transactions", store], () => {
    if (store.partitionIds.length === 0 && store.categoryIds.length === 0) {
      return rpc.post.getUserTransactions({
        userId: userId,
        tssDate: store.tssDate?.toISOString(),
        tseDate: store.tseDate?.toISOString(),
      });
    }
    return rpc.post.findTransactions({
      partitionIds: store.partitionIds,
      categoryIds: store.categoryIds,
      ownerId: userId,
      tssDate: store.tssDate?.toISOString(),
      tseDate: store.tseDate?.toISOString(),
    });
  });
  return (
    <QueryResult
      query={transactions}
      as="div"
      className={css({ padding: "1rem" })}
      onLoading={<>Loading transactions...</>}
      onUndefined={<>Select a partition to show transactions</>}
    >
      {(transactions) => (
        <ul>
          {transactions.map((transaction) => {
            return (
              <li key={transaction.id}>
                <button
                  className={css({ cursor: "pointer" })}
                  onClick={async () => {
                    setIsDeleting(true);
                    await rpc.post.deleteTransaction({
                      transactionId: transaction.id,
                    });
                    queryClient.invalidateQueries({
                      queryKey: ["transactions"],
                    });
                    queryClient.invalidateQueries({
                      queryKey: ["user", userId],
                    });
                    queryClient.invalidateQueries({
                      queryKey: [
                        "partitionBalance",
                        {
                          partitionId: transaction.source_partition.id,
                          tssDate: store.tssDate,
                          tseDate: store.tseDate,
                        },
                      ],
                    });
                    queryClient.invalidateQueries({
                      queryKey: [
                        "accountBalance",
                        {
                          accountId: transaction.source_partition.account.id,
                          tssDate: store.tssDate,
                          tseDate: store.tseDate,
                        },
                      ],
                    });
                    queryClient.invalidateQueries({
                      queryKey: [
                        "categoryBalance",
                        {
                          categoryId: transaction.category.id,
                          tssDate: store.tssDate,
                          tseDate: store.tseDate,
                        },
                      ],
                    });
                    setIsDeleting(false);
                  }}
                  disabled={isDeleting}
                >
                  x
                </button>{" "}
                | {transaction.source_partition.name} | {transaction.value} |{" "}
                {transaction.category.name} | {transaction.description} | {transaction.str_date}
              </li>
            );
          })}
        </ul>
      )}
    </QueryResult>
  );
}

function TransactionForm({ user }: { user: { id: string } }) {
  const queryClient = useQueryClient();
  const [store] = useContext(UserPageStoreContext);
  const partitions = useQuery(["partitions", user.id], () => {
    return rpc.post.getVisiblePartitions({ userId: user.id });
  });
  const categories = useQuery(["categories", user.id], () => {
    return rpc.post.getUserCategories({ userId: user.id });
  });
  const [isDestinationKnown, setIsDestinationKnown] = useState(false);
  const [inputValue, setInputValue] = useState("");

  let isExpense = false;
  let value: number;
  try {
    value = parseFloat(inputValue);
    if (!isNaN(value)) {
      isExpense = value < 0;
    }
  } catch (_error) {}

  return (
    <form
      className={css({ display: "flex", flexDirection: "column" })}
      onSubmit={async (event) => {
        event.preventDefault();
        const target = event.target as HTMLFormElement;
        const formdata = new FormData(target as HTMLFormElement);
        const formObj = Object.fromEntries(formdata.entries());
        const dataSchema = object({
          sourcePartitionId: string(),
          destinationPartitionId: optional(string()),
          categoryId: string(),
          value: number(),
          description: optional(string()),
          userId: string(),
        });
        const parsedData = dataSchema.parse({
          ...formObj,
          userId: user.id,
          value,
        });
        const { source, destination } = await rpc.post.createTransaction(
          parsedData
        );
        target.reset();
        if (source) {
          setInputValue("");
          queryClient.invalidateQueries({ queryKey: ["transactions"] });
          queryClient.invalidateQueries({
            queryKey: [
              "categoryBalance",
              {
                categoryId: parsedData.categoryId,
                tssDate: store.tssDate,
                tseDate: store.tseDate,
              },
            ],
          });
          queryClient.invalidateQueries({
            queryKey: [
              "partitionBalance",
              {
                partitionId: parsedData.sourcePartitionId,
                tssDate: store.tssDate,
                tseDate: store.tseDate,
              },
            ],
          });
          queryClient.invalidateQueries({
            queryKey: [
              "accountBalance",
              {
                accountId: source.source_partition.account.id,
                tssDate: store.tssDate,
                tseDate: store.tseDate,
              },
            ],
          });
        }
        if (destination) {
          queryClient.invalidateQueries({
            queryKey: [
              "partitionBalance",
              {
                partitionId: parsedData.destinationPartitionId,
                tssDate: store.tssDate,
                tseDate: store.tseDate,
              },
            ],
          });
          queryClient.invalidateQueries({
            queryKey: [
              "accountBalance",
              {
                accountId: destination.source_partition.account.id,
                tssDate: store.tssDate,
                tseDate: store.tseDate,
              },
            ],
          });
        }
      }}
    >
      <label htmlFor="sourcePartitionId">Source Partition</label>
      <QueryResult query={partitions}>
        {(partitions) => (
          <select name="sourcePartitionId">
            {partitions.map((partition) => (
              <option key={partition.id} value={partition.id}>
                {partition.name}
              </option>
            ))}
          </select>
        )}
      </QueryResult>
      <label htmlFor="value">Value</label>
      <input
        type="text"
        inputMode="numeric"
        name="value"
        value={inputValue}
        onInput={(event) => {
          setInputValue((event.target as HTMLInputElement).value);
        }}
      />
      {isExpense && (
        <>
          <label htmlFor="isDestinationKnown">Known Destination</label>
          <input
            type="checkbox"
            name="isDestinationKnown"
            checked={isDestinationKnown}
            onChange={(event) => {
              setIsDestinationKnown(event.target.checked);
            }}
          />
          {isDestinationKnown && (
            <>
              <label htmlFor="destinationPartitionId">
                Destination Partition
              </label>
              <QueryResult query={partitions}>
                {(partitions) => (
                  <select name="destinationPartitionId">
                    {partitions.map((partition) => (
                      <option key={partition.id} value={partition.id}>
                        {partition.name}
                      </option>
                    ))}
                  </select>
                )}
              </QueryResult>
            </>
          )}
        </>
      )}

      <label htmlFor="categoryId">Category</label>
      <QueryResult query={categories}>
        {(categories) => (
          <select name="categoryId">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </QueryResult>
      <label htmlFor="description">Description</label>
      <input type="text" name="description" />
      <input type="submit" value="Submit" />
    </form>
  );
}

function DateRange({ userId }: { userId: string }) {
  const [store, dispatch] = useContext(UserPageStoreContext);
  return (
    <div>
      <div>
        <label htmlFor="startDate">Start Date</label>
        <input
          type="date"
          name="startDate"
          value={store.tssDate?.toISOString().split("T")[0] ?? ""}
          onChange={(event) => {
            dispatch({
              type: "SET_TSS_DATE",
              payload: event.target.value
                ? new Date(event.target.value)
                : undefined,
            });
          }}
        />
      </div>
      <div>
        <label htmlFor="endDate">End Date</label>
        <input
          type="date"
          name="endDate"
          value={store.tseDate?.toISOString().split("T")[0] ?? ""}
          onChange={(event) => {
            dispatch({
              type: "SET_TSE_DATE",
              payload: event.target.value
                ? new Date(event.target.value)
                : undefined,
            });
          }}
        />
      </div>
    </div>
  );
}

function LoadingValue<R>(props: {
  queryKey: [string, ...any];
  valueLoader: () => Promise<R>;
}) {
  return (
    <QueryResult
      query={useQuery(props.queryKey, props.valueLoader)}
      as="span"
      className={css({ marginLeft: "0.5rem" })}
      onLoading={<>...</>}
      onUndefined={<>Missing Value</>}
    >
      {(value) => <>{value}</>}
    </QueryResult>
  );
}

function QueryResult<T>(props: {
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

function isSubset(subset: string[], superset: string[]) {
  return subset.every((item) => superset.includes(item));
}
