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
import { Unpacked, formatValue, groupBy } from "@/utils/common";

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
      className={css({ display: "flex", height: "100%" })}
      onLoading={<>Loading {`${username}'s accounts`}...</>}
      onUndefined={<>{`${username}'s data`} not found</>}
    >
      {(user) => (
        <>
          <SideBar user={user} />
          <div
            className={css({
              height: "100%",
              display: "flex",
              backgroundColor: "#f5f5f5",
              flexDirection: "column",
              flexGrow: 1,
            })}
          >
            <TransactionForm user={user} />
            <Transactions userId={user.id} />
          </div>
        </>
      )}
    </QueryResult>
  );
}

type FindUserResult = NonNullable<
  Unpacked<Awaited<ReturnType<typeof rpc.post.findUser>>>
>;

function SectionLabel(props: { children: React.ReactNode }) {
  return (
    <h1
      className={css({
        fontWeight: "bold",
        textAlign: "center",
        margin: "0.5rem 0",
        fontSize: "1.1rem",
        display: "flex",
      })}
    >
      <span
        className={css({
          height: "1px",
          alignSelf: "center",
          flexGrow: 1,
          borderBottom: "0.5px solid black",
        })}
      ></span>
      <span
        className={css({
          margin: "0 1rem",
        })}
      >
        {props.children}
      </span>
      <span
        className={css({
          height: "1px",
          alignSelf: "center",
          flexGrow: 1,
          borderBottom: "0.5px solid black",
        })}
      ></span>
    </h1>
  );
}

function SideBar({ user }: { user: FindUserResult }) {
  return (
    <div
      className={css({
        width: "1/4",
        minWidth: "18rem",
        height: "100%",
        display: "flex",
        backgroundColor: "#f5f5f5",
        flexDirection: "column",
        justifyContent: "space-between",
      })}
    >
      <div
        className={css({
          flexGrow: 1,
          overflowY: "scroll",
          padding: "1rem 0.75rem 1rem 1rem",
          "&::-webkit-scrollbar": {
            width: "0.25rem",
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "lightgray",
          },
        })}
      >
        <SectionLabel>Accounts</SectionLabel>
        <Accounts userId={user.id} />
        <SectionLabel>Categories</SectionLabel>
        <Categories userId={user.id} />
      </div>
      <DateRange userId={user.id} />
    </div>
  );
}

function Accounts({ userId }: { userId: string }) {
  const [store, dispatch] = useContext(UserPageStoreContext);
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
              fontWeight: "bold",
            })}
            onClick={() => {
              dispatch({
                type: "TOGGLE_ACCOUNT",
                payload: account.partitions.map((p) => p.id),
              });
            }}
          >
            <div
              className={css({
                display: "flex",
                justifyContent: "space-between",
              })}
            >
              <span>{account.label}</span>
              <LoadingValue
                queryKey={[
                  "accountBalance",
                  {
                    accountId: account.id,
                  },
                ]}
                valueLoader={() =>
                  rpc.post.getAccountBalance({
                    accountId: account.id,
                    userId,
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
      onLoading={<>Loading partitions...</>}
      onUndefined={<>No partitions found</>}
    >
      {(partitions) => (
        <ul className={css({ paddingStart: "0.5rem" })}>
          {partitions.map((partition) => (
            <li
              key={partition.id}
              className={css({
                display: "flex",
                justifyContent: "space-between",
                fontWeight: "medium",
                cursor: "pointer",
                color: store.partitionIds.includes(partition.id)
                  ? "blue"
                  : "inherit",
              })}
              onClick={(event) => {
                event.stopPropagation();
                dispatch({
                  type: "TOGGLE_PARTITIONS",
                  payload: [partition.id],
                });
              }}
            >
              <span>{partition.name}</span>
              <LoadingValue
                queryKey={[
                  "partitionBalance",
                  {
                    partitionId: partition.id,
                  },
                ]}
                valueLoader={() =>
                  rpc.post.getPartitionBalance({
                    partitionId: partition.id,
                    userId,
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
  const [store, dispatch] = useContext(UserPageStoreContext);
  const categoryLabelClass = css({
    display: "flex",
    justifyContent: "space-between",
    fontWeight: "bold",
    cursor: "pointer",
  });
  const categoryListClass = css({
    paddingStart: "0.5rem",
    paddingBottom: "0.5rem",
  });
  const selectCategories = (kind: string) => {
    if (kind === "Income") {
      if (categories?.data?.income) {
        dispatch({
          type: "TOGGLE_CATEGORY_KIND",
          payload: categories.data.income.map((c) => c.id),
        });
      }
    } else if (kind === "Expense") {
      if (categories?.data?.expense) {
        dispatch({
          type: "TOGGLE_CATEGORY_KIND",
          payload: categories.data.expense.map((c) => c.id),
        });
      }
    } else if (kind === "Transfer") {
      if (categories?.data?.transfer) {
        dispatch({
          type: "TOGGLE_CATEGORY_KIND",
          payload: categories.data.transfer.map((c) => c.id),
        });
      }
    }
  };
  return (
    <>
      <QueryResult
        query={categories}
        as="div"
        onLoading={<>Loading categories...</>}
        onUndefined={<>No categories found</>}
      >
        {(categories) => (
          <>
            <div
              onClick={() => selectCategories("Income")}
              className={categoryLabelClass}
            >
              <span>Income</span>
              <LoadingValue
                queryKey={["categoryKindBalance", "Income"]}
                valueLoader={() =>
                  rpc.post.getCategoryKindBalance({
                    kind: "Income",
                    userId,
                  })
                }
              />
            </div>
            <ul className={categoryListClass}>
              {categories.income.map((category) => (
                <Category
                  key={category.id}
                  category={category}
                  userId={userId}
                />
              ))}
            </ul>
            <div
              onClick={() => selectCategories("Expense")}
              className={categoryLabelClass}
            >
              <span>Expense</span>
              <LoadingValue
                queryKey={["categoryKindBalance", "Expense"]}
                valueLoader={() =>
                  rpc.post.getCategoryKindBalance({
                    kind: "Expense",
                    userId,
                  })
                }
              />
            </div>
            <ul className={categoryListClass}>
              {categories.expense.map((category) => (
                <Category
                  key={category.id}
                  category={category}
                  userId={userId}
                />
              ))}
            </ul>
            <div
              onClick={() => selectCategories("Transfer")}
              className={categoryLabelClass}
            >
              <span>Transfer</span>
              <LoadingValue
                queryKey={["categoryKindBalance", "Transfer"]}
                valueLoader={() =>
                  rpc.post.getCategoryKindBalance({
                    kind: "Transfer",
                    userId,
                  })
                }
              />
            </div>
            <ul className={categoryListClass}>
              {categories.transfer.map((category) => (
                <Category
                  key={category.id}
                  category={category}
                  userId={userId}
                />
              ))}
            </ul>
          </>
        )}
      </QueryResult>
      {/* <form
        className={css({
          margin: "1rem 0",
          display: "flex",
          flexDirection: "column",
        })}
        onSubmit={async (event) => {
          event.preventDefault();
          const target = event.target as HTMLFormElement;
          const formdata = new FormData(target as HTMLFormElement);
          const formObj = Object.fromEntries(formdata.entries());
          const dataSchema = object({ name: string(), kind: string() });
          const parsedData = dataSchema.parse(formObj);
          await rpc.post.createUserCategory({
            userId,
            name: parsedData.name,
            kind: parsedData.kind,
          });
          target.reset();
          queryClient.invalidateQueries({ queryKey: ["categories", userId] });
        }}
      >
        <h1>Create Category</h1>
        <label htmlFor="name">Name:</label>
        <input type="text" name="name" placeholder="E.g. Salary" />
        <label htmlFor="kind">Kind: </label>
        <select name="kind" defaultValue="Expense">
          <option value="Income">Income</option>
          <option value="Expense">Expense</option>
          <option value="Transfer">Transfer</option>
        </select>
        <input type="submit" value="Create"></input>
      </form> */}
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
        fontWeight: "medium",
        display: "flex",
        justifyContent: "space-between",
      })}
      onClick={() => {
        dispatch({ type: "TOGGLE_CATEGORIES", payload: [category.id] });
      }}
    >
      {/* TODO: This delete button should be conditionally shown. Only categories without linked transactions can be deleted. */}
      {/* <button
        onClick={async (event) => {
          event.stopPropagation();
          setIsDeleting(true);
          await rpc.post.deleteCategory({ categoryId: category.id });
          queryClient.invalidateQueries({ queryKey: ["categories", userId] });
        }}
      >
        x
      </button>{" "} */}
      <span>{category.name}</span>
      <LoadingValue
        queryKey={[
          "categoryBalance",
          {
            categoryId: category.id,
          },
        ]}
        valueLoader={() =>
          rpc.post.getCategoryBalance({
            userId,
            categoryId: category.id,
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
    return rpc.post.findTransactions({
      partitionIds: store.partitionIds,
      categoryIds: store.categoryIds,
      ownerId: userId,
      tssDate: store.tssDate?.toISOString(),
      tseDate: store.tseDate?.toISOString(),
    });
  });

  type Transaction = NonNullable<Unpacked<typeof transactions.data>>;

  const getPartitionColumn = (transaction: Transaction) => {
    if (transaction.kind === "Transfer") {
      if (transaction.counterpart) {
        return `${transaction.source_partition.label} -> ${transaction.counterpart.source_partition.label}`;
      } else {
        return `${transaction.source_partition.label} -> private partition`;
      }
    } else {
      return transaction.source_partition.label;
    }
  };

  const getCategoryLabel = (category: Transaction["category"]) => {
    const prefix = category.kind[0];
    return `[${prefix}] ${category.name}`;
  };

  return (
    <QueryResult
      query={transactions}
      as="div"
      className={css({ margin: "0.5rem", overflowY: "scroll" })}
      onLoading={<>Loading transactions...</>}
      onUndefined={<>Select a partition to show transactions</>}
    >
      {(transactions) => (
        <table
          className={css({
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: "0",
            "& td": {
              px: "2",
              py: "1",
              maxWidth: "350px",
              whiteSpace: "nowrap",
            },
            "& th": {
              px: "2",
              py: "1",
              maxWidth: "350px",
              whiteSpace: "nowrap",
              borderTop: "1px solid black",
              borderBottom: "3px double black",
            },
            "& thead tr": {
              fontWeight: "bold",
            },
            "& tbody tr:nth-child(odd)": {
              backgroundColor: "#e5e5e5",
            },
          })}
        >
          <thead
            className={css({
              position: "sticky",
              top: 0,
              backgroundColor: "#f5f5f5",
            })}
          >
            <tr>
              <th className={css({ textAlign: "left" })}>Date</th>
              <th className={css({ textAlign: "left" })}>Category</th>
              <th className={css({ textAlign: "left" })}>Partition</th>
              <th className={css({ textAlign: "right" })}>Value</th>
              <th className={css({ textAlign: "left" })}>Description</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => {
              return (
                <tr key={transaction.id}>
                  <td>{transaction.str_date.slice(5)}</td>
                  <td>{getCategoryLabel(transaction.category)}</td>
                  <td>{getPartitionColumn(transaction)}</td>
                  <td className={css({ textAlign: "right" })}>
                    {formatValue(parseFloat(transaction.value))}
                  </td>
                  <td>{transaction.description}</td>
                  <td>
                    <button
                      className={css({
                        cursor: "pointer",
                        padding: "0 0.25rem",
                      })}
                      onClick={async () => {
                        setIsDeleting(true);
                        await rpc.post.deleteTransaction({
                          transactionId: transaction.id,
                          userId,
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
                            },
                          ],
                        });
                        queryClient.invalidateQueries({
                          queryKey: [
                            "accountBalance",
                            {
                              accountId:
                                transaction.source_partition.account.id,
                            },
                          ],
                        });
                        queryClient.invalidateQueries({
                          queryKey: [
                            "categoryBalance",
                            {
                              categoryId: transaction.category.id,
                            },
                          ],
                        });
                        queryClient.invalidateQueries({
                          queryKey: [
                            "categoryKindBalance",
                            transaction.category.kind,
                          ],
                        });
                        setIsDeleting(false);
                      }}
                      disabled={isDeleting}
                    >
                      x
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </QueryResult>
  );
}

function FormInput(props: {
  children: React.ReactNode;
  flexGrow?: number;
  width: string;
}) {
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        flexGrow: props.flexGrow,
        width: props.width,
        padding: "0.5rem",
        "& *": {
          padding: "0.25rem 0.50rem",
          borderRadius: "0.25rem",
        },
        "& *:focus": {
          outline: "1px solid blue",
        },
        "& label": {
          fontSize: "0.8rem",
          fontWeight: "medium",
        },
        "& select": {
          appearance: "none",
          // TODO: Check the security of this background image.
          backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23131313%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
          backgroundRepeat: "no-repeat, repeat",
          backgroundPosition: "right .7em top 50%, 0 0",
          backgroundSize: ".65em auto, 100%",
        },
      })}
    >
      {props.children}
    </div>
  );
}

function TransactionForm({ user }: { user: { id: string } }) {
  const queryClient = useQueryClient();
  const [store] = useContext(UserPageStoreContext);
  const partitions = useQuery(["partitions", user.id], () => {
    return rpc.post.getPartitionOptions({ userId: user.id });
  });
  const categories = useQuery(["categories", user.id], () => {
    return rpc.post.getUserCategories({ userId: user.id });
  });
  const [inputCategoryKind, setInputCategoryKind] = useState("");
  const [inputCategoryIsPrivate, setInputCategoryIsPrivate] = useState(false);
  const [inputValue, setInputValue] = useState("");

  let value: number | undefined = undefined;
  try {
    value = parseFloat(inputValue);
  } catch (_error) {}

  type Partition = NonNullable<Unpacked<typeof partitions.data>>;
  type Category = Unpacked<
    NonNullable<Unpacked<typeof categories.data>>["expense"]
  >;

  const getPartitionOptions = (
    partitions: Partition[],
    onlyPrivate: boolean
  ) => {
    const groupedPartitions = groupBy(partitions, (p) => p.account.id);
    return (
      <>
        {Object.entries(groupedPartitions).map(([accountId, partitions]) => {
          const partitionsToShow = partitions.filter((p) =>
            onlyPrivate ? p.is_private : true
          );
          if (partitionsToShow.length === 0) return null;
          return (
            <optgroup key={accountId} label={partitions[0].account.label}>
              {partitionsToShow.map((partition) => (
                <option key={partition.id} value={partition.id}>
                  {partition.name}
                </option>
              ))}
            </optgroup>
          );
        })}
      </>
    );
  };

  const getCategoryOptionName = (category: Category) => {
    if (category.is_private) {
      return `${category.name} (Private)`;
    } else {
      return category.name;
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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
    const { transaction, counterpart } = await rpc.post.createTransaction(
      parsedData
    );
    target.reset();
    if (transaction) {
      setInputValue("");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({
        queryKey: [
          "categoryBalance",
          {
            categoryId: parsedData.categoryId,
          },
        ],
      });
      queryClient.invalidateQueries({
        queryKey: [
          "partitionBalance",
          {
            partitionId: parsedData.sourcePartitionId,
          },
        ],
      });
      queryClient.invalidateQueries({
        queryKey: [
          "accountBalance",
          {
            accountId: transaction.source_partition.account.id,
          },
        ],
      });
      queryClient.invalidateQueries({
        queryKey: ["categoryKindBalance", transaction.category.kind],
      });
    }
    if (counterpart) {
      queryClient.invalidateQueries({
        queryKey: [
          "partitionBalance",
          {
            partitionId: parsedData.destinationPartitionId,
          },
        ],
      });
      queryClient.invalidateQueries({
        queryKey: [
          "accountBalance",
          {
            accountId: counterpart.source_partition.account.id,
          },
        ],
      });
      queryClient.invalidateQueries({
        queryKey: ["categoryKindBalance", counterpart.category.kind],
      });
    }
  };

  return (
    <form onSubmit={onSubmit} className={css({ display: "flex" })}>
      <FormInput flexGrow={2} width="20%">
        <label htmlFor="categoryId">Category</label>
        <QueryResult query={categories}>
          {(categories) => (
            <select
              name="categoryId"
              onChange={(event) => {
                const selectedCategory = [
                  ...categories.income,
                  ...categories.expense,
                  ...categories.transfer,
                ].find((c) => c.id === event.target.value);
                if (!selectedCategory) return;
                setInputCategoryKind(selectedCategory.kind);
                setInputCategoryIsPrivate(selectedCategory.is_private);
              }}
            >
              <optgroup label="Income">
                {categories.income.map((c) => (
                  <option key={c.id} value={c.id}>
                    {getCategoryOptionName(c)}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Expenses">
                {categories.expense.map((c) => (
                  <option key={c.id} value={c.id}>
                    {getCategoryOptionName(c)}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Transfers">
                {categories.transfer.map((c) => (
                  <option key={c.id} value={c.id}>
                    {getCategoryOptionName(c)}
                  </option>
                ))}
              </optgroup>
            </select>
          )}
        </QueryResult>
      </FormInput>
      <FormInput flexGrow={2} width="20%">
        <label htmlFor="sourcePartitionId">Source Partition</label>
        <QueryResult query={partitions}>
          {(partitions) => (
            <select name="sourcePartitionId">
              {getPartitionOptions(partitions, inputCategoryIsPrivate)}
            </select>
          )}
        </QueryResult>
      </FormInput>

      {inputCategoryKind == "Transfer" ? (
        <FormInput flexGrow={2} width="20%">
          <label htmlFor="destinationPartitionId">Destination Partition</label>
          <QueryResult query={partitions}>
            {(partitions) => (
              <select name="destinationPartitionId">
                {getPartitionOptions(partitions, inputCategoryIsPrivate)}
              </select>
            )}
          </QueryResult>
        </FormInput>
      ) : null}
      <FormInput flexGrow={1} width="10%">
        <label htmlFor="value">Value</label>
        <input
          className={css({ textAlign: "right" })}
          type="text"
          inputMode="numeric"
          name="value"
          value={inputValue}
          onInput={(event) => {
            setInputValue((event.target as HTMLInputElement).value);
          }}
        />
      </FormInput>
      <FormInput flexGrow={4} width="40%">
        <label htmlFor="description">Description</label>
        <input type="text" name="description" />
      </FormInput>
      <input type="submit" value="Create" hidden />
    </form>
  );
}

function DateRange({ userId }: { userId: string }) {
  const [store, dispatch] = useContext(UserPageStoreContext);
  return (
    <div
      className={css({
        borderTop: "1px solid lightgray",
        padding: "1rem",
      })}
    >
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

function LoadingValue(props: {
  queryKey: [string, ...any];
  valueLoader: () => Promise<string>;
}) {
  return (
    <QueryResult
      query={useQuery(props.queryKey, props.valueLoader)}
      onLoading={<>...</>}
      onUndefined={<>Missing Value</>}
    >
      {(value) => {
        const parsedValue = parseFloat(value);
        let result;
        if (isNaN(parsedValue)) {
          result = value;
        } else {
          result = formatValue(parsedValue);
        }
        return (
          <span
            className={css({
              marginLeft: "0.5rem",
            })}
          >
            {result}
          </span>
        );
      }}
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
