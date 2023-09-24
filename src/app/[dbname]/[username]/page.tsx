"use client";

import { MouseEventHandler, useContext, useState, useRef } from "react";
import { rpc } from "../../rpc_client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { boolean, minLength, object, optional, string } from "valibot";
import { UserPageStoreProvider, UserPageStoreContext } from "./store";
import { QueryResult, Unpacked, formatValue, groupBy } from "@/utils/common";
import {
  Box,
  Flex,
  IconButton,
  ScrollArea,
  Table,
  Text,
  Checkbox,
  Separator,
  textPropDefs,
  Dialog,
  TextField,
  Button,
  Select,
  Switch,
  Grid,
} from "@radix-ui/themes";
import { Cross1Icon, PlusIcon } from "@radix-ui/react-icons";
import { TransactionForm } from "./transaction_form";
import { TransactionsTable } from "./transactions_table";

export default function Main(props: {
  params: { username: string; dbname: string };
}) {
  const { username, dbname } = props.params;
  return (
    <UserPageStoreProvider>
      <UserPage username={username} dbname={dbname} />
    </UserPageStoreProvider>
  );
}

export function UserPage({
  username,
  dbname,
}: {
  username: string;
  dbname: string;
}) {
  const user = useQuery(["user", username], () => {
    return rpc.post.findUser({ username, dbname });
  });
  return (
    <QueryResult
      query={user}
      onLoading={<>Loading {`${username}'s accounts`}...</>}
      onUndefined={<>{`${username}'s data`} not found</>}
    >
      {(user) => (
        <Flex gap="3">
          <SideBar user={user} />
          <Box
            position="fixed"
            top="0"
            right="0"
            bottom="0"
            style={{
              left: "350px",
            }}
          >
            <ScrollArea scrollbars="vertical">
              <Flex direction="column" p="2" pr="4">
                <TransactionForm user={user} />
                <TransactionsTable user={user} />
              </Flex>
            </ScrollArea>
          </Box>
        </Flex>
      )}
    </QueryResult>
  );
}

type FindUserResult = NonNullable<
  Unpacked<Awaited<ReturnType<typeof rpc.post.findUser>>>
>;

function SectionLabel(props: { children: React.ReactNode; label: string }) {
  return (
    <Dialog.Root>
      <Flex align="center" justify="between" p="2" px="4">
        <Text size="4" weight="bold">
          {props.label}
        </Text>
        <Dialog.Trigger>
          <IconButton radius="full" mr="2" variant="ghost">
            <PlusIcon width="18" height="18" />
          </IconButton>
        </Dialog.Trigger>
        {props.children}
      </Flex>
    </Dialog.Root>
  );
}

const newPartitionSchema = object({
  name: string([minLength(1)]),
  isPrivate: boolean(),
  accountId: string(),
  accountName: optional(string()),
  isSharedAccount: boolean(),
});

const newCategorySchema = object({
  name: string([minLength(1)]),
  kind: string(),
  isPrivate: boolean(),
});

function TwoColumnInput(props: { children: React.ReactNode }) {
  return (
    <Grid asChild columns="125px 1fr" align="center">
      <label>{props.children}</label>
    </Grid>
  );
}

function SideBar({ user }: { user: FindUserResult }) {
  const queryClient = useQueryClient();
  const categoryFormRef = useRef<HTMLFormElement>(null);
  const partitionFormRef = useRef<HTMLFormElement>(null);
  const ownedAccounts = useQuery(["accounts", user.id, true], () => {
    return rpc.post.getAccounts({
      userId: user.id,
      dbname: user.dbname,
      owned: true,
    });
  });
  const [accountId, setAccountId] = useState("for-new-account");
  return (
    <Box
      position="fixed"
      top="0"
      left="0"
      bottom="0"
      style={{ minWidth: "350px" }}
    >
      <Flex direction="column" height="100%">
        <ScrollArea scrollbars="vertical">
          <SectionLabel label="Accounts">
            <Dialog.Content style={{ maxWidth: 500 }}>
              <Dialog.Title>New Partition</Dialog.Title>
              <Separator size="4" mb="4" />
              <Flex direction="column" gap="3" asChild>
                <form
                  id="partition-form"
                  ref={partitionFormRef}
                  onSubmit={async (e) => {
                    e.preventDefault();

                    const formdata = new FormData(e.target as HTMLFormElement);

                    const parsedData = newPartitionSchema.parse({
                      ...Object.fromEntries(formdata.entries()),
                      isPrivate: formdata.get("isPrivate") === "on",
                      isSharedAccount: formdata.get("isSharedAccount") === "on",
                    });

                    const {
                      name,
                      isPrivate,
                      accountId,
                      accountName,
                      isSharedAccount,
                    } = parsedData;

                    let forNewAccount = false;
                    if (accountId === "for-new-account") {
                      forNewAccount = true;
                      if (!accountName?.trim()) {
                        throw new Error("Account name is required");
                      }
                    }
                    await rpc.post.createPartition({
                      userId: user.id,
                      dbname: user.dbname,
                      name,
                      isPrivate,
                      forNewAccount,
                      accountId,
                      isSharedAccount,
                      newAccountName: accountName,
                    });
                    queryClient.invalidateQueries({
                      queryKey: ["accounts", user.id],
                    });
                    queryClient.invalidateQueries({
                      queryKey: ["partitions", user.id],
                    });
                  }}
                >
                  <TwoColumnInput>
                    <Text as="div" size="2" mb="1" weight="bold">
                      Name
                    </Text>
                    <TextField.Input
                      name="name"
                      placeholder="Enter partition name"
                    />
                  </TwoColumnInput>

                  <TwoColumnInput>
                    <Text as="div" size="2" mb="1" weight="bold">
                      Private
                    </Text>
                    <Switch name="isPrivate" />
                  </TwoColumnInput>

                  <TwoColumnInput>
                    <Text as="div" size="2" mb="1" weight="bold">
                      Account
                    </Text>
                    <Select.Root
                      name="accountId"
                      value={accountId}
                      onValueChange={(value) => {
                        setAccountId(value);
                      }}
                    >
                      <Select.Trigger variant="surface" />
                      <Select.Content>
                        <Select.Item value="for-new-account">
                          Create New Account
                        </Select.Item>
                        {ownedAccounts.data && (
                          <Select.Group>
                            <Select.Label>My Accounts</Select.Label>
                            {ownedAccounts.data.map((acc) => (
                              <Select.Item value={acc.id} key={acc.id}>
                                {acc.name}
                              </Select.Item>
                            ))}
                          </Select.Group>
                        )}
                      </Select.Content>
                    </Select.Root>
                  </TwoColumnInput>

                  {accountId === "for-new-account" && (
                    <>
                      <TwoColumnInput>
                        <Text as="div" size="2" mb="1" weight="bold">
                          Account Name
                        </Text>
                        <TextField.Input
                          name="accountName"
                          placeholder="E.g. InterBank"
                        />
                      </TwoColumnInput>
                      <TwoColumnInput>
                        <Text as="div" size="2" mb="1" weight="bold">
                          Shared?
                        </Text>
                        <Switch name="isSharedAccount" />
                      </TwoColumnInput>
                    </>
                  )}
                </form>
              </Flex>
              <Separator size="4" mt="4" />
              <Flex gap="3" mt="4" justify="start" direction="row-reverse">
                <Dialog.Close type="submit" form="partition-form">
                  <Button>Save</Button>
                </Dialog.Close>
                <Dialog.Close>
                  <Button variant="soft" color="gray">
                    Cancel
                  </Button>
                </Dialog.Close>
              </Flex>
            </Dialog.Content>
          </SectionLabel>
          <Accounts user={user} />
          <SectionLabel label="Categories">
            <Dialog.Content style={{ maxWidth: 500 }}>
              <Dialog.Title>New Category</Dialog.Title>
              <Separator size="4" mb="4" />
              <Flex direction="column" gap="3" asChild>
                <form
                  id="category-form"
                  ref={categoryFormRef}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const formdata = new FormData(e.target as HTMLFormElement);
                    const parsedData = newCategorySchema.parse({
                      ...Object.fromEntries(formdata.entries()),
                      isPrivate: formdata.get("isPrivate") === "on",
                    });
                    const { name, kind, isPrivate } = parsedData;
                    await rpc.post.createCategory({
                      userId: user.id,
                      dbname: user.dbname,
                      name,
                      kind,
                      isPrivate,
                    });
                    queryClient.invalidateQueries({
                      queryKey: ["categories", user.id],
                    });
                  }}
                >
                  <TwoColumnInput>
                    <Text as="div" size="2" mb="1" weight="bold">
                      Name
                    </Text>
                    <TextField.Input
                      name="name"
                      placeholder="Enter category name"
                    />
                  </TwoColumnInput>
                  <TwoColumnInput>
                    <Text as="div" size="2" mb="1" weight="bold">
                      Kind
                    </Text>
                    <Select.Root defaultValue="Income" name="kind">
                      <Select.Trigger variant="surface" />
                      <Select.Content>
                        <Select.Item value="Income">Income</Select.Item>
                        <Select.Item value="Expense">Expense</Select.Item>
                        <Select.Item value="Transfer">Transfer</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </TwoColumnInput>
                  <TwoColumnInput>
                    <Text as="div" size="2" mb="1" weight="bold">
                      Private
                    </Text>
                    <Switch name="isPrivate" />
                  </TwoColumnInput>
                </form>
              </Flex>
              <Separator size="4" mt="4" />
              <Flex gap="3" mt="4" justify="start" direction="row-reverse">
                <Dialog.Close type="submit" form="category-form">
                  <Button>Save</Button>
                </Dialog.Close>
                <Dialog.Close>
                  <Button variant="soft" color="gray">
                    Cancel
                  </Button>
                </Dialog.Close>
              </Flex>
            </Dialog.Content>
          </SectionLabel>
          <Categories user={user} />
        </ScrollArea>
        <DateRange user={user} />
      </Flex>
    </Box>
  );
}

type Account = Unpacked<
  NonNullable<Awaited<ReturnType<typeof rpc.post.getAccounts>>>
>;

function AccountLI({
  account,
  user,
}: {
  account: Account;
  user: { id: string; dbname: string };
}) {
  const queryClient = useQueryClient();
  const canBeDeleted = useQuery(
    ["accountCanBeDeleted", { accountId: account.id }],
    () => {
      return rpc.post.accountCanBeDeleted({
        accountId: account.id,
        dbname: user.dbname,
        userId: user.id,
      });
    }
  );
  const deleteAccount = useMutation(
    () => {
      return rpc.post.deleteAccount({
        accountId: account.id,
        dbname: user.dbname,
        userId: user.id,
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["accounts", user.id],
        });
      },
    }
  );
  const [store, dispatch] = useContext(UserPageStoreContext);
  return (
    <Box px="4" mb="1" key={account.id}>
      <Flex
        pr="2"
        justify="between"
        onClick={() => {
          dispatch({
            type: "TOGGLE_ACCOUNT",
            payload: account.partitions.map((p) => p.id),
          });
        }}
      >
        <Flex align="center" gap="1">
          <Text style={{ cursor: "pointer" }} weight="medium">
            {account.label}
          </Text>
          {canBeDeleted.data && (
            <DeleteButton
              onClick={async (e) => {
                e.stopPropagation();
                await deleteAccount.mutateAsync();
              }}
            />
          )}
        </Flex>
        <LoadingValue
          expect={(value) => value > 0}
          queryKey={[
            "accountBalance",
            {
              accountId: account.id,
            },
          ]}
          valueLoader={() =>
            rpc.post.getAccountBalance({
              accountId: account.id,
              userId: user.id,
              dbname: user.dbname,
            })
          }
        />
      </Flex>
      <Partitions accountId={account.id} user={user} />
    </Box>
  );
}

const getAccountGroup = (
  account: Account,
  userId: string
): "owned" | "common" | "others" => {
  if (account.owners.length === 1 && account.owners[0].id === userId) {
    return "owned";
  } else if (
    account.owners.length > 1 &&
    account.owners.map((o) => o.id).includes(userId)
  ) {
    return "common";
  } else {
    return "others";
  }
};

function GroupedAccounts(props: {
  title: string;
  accounts: Account[];
  user: { id: string; dbname: string };
  showTitle: boolean;
}) {
  const { title, accounts, user, showTitle } = props;
  return (
    <>
      {showTitle && (
        <Flex justify="center" align="center" mb="1">
          <Separator size="3" />
          <Box px="4">
            <Text size="1" weight="medium">
              {title.toUpperCase()}
            </Text>
          </Box>
          <Separator size="3" />
        </Flex>
      )}
      <Box>
        {accounts.map((account) => (
          <AccountLI account={account} user={user} key={account.id} />
        ))}
      </Box>
    </>
  );
}

function Accounts({ user }: { user: { id: string; dbname: string } }) {
  const accounts = useQuery(["accounts", user.id, false], () => {
    return rpc.post.getAccounts({
      userId: user.id,
      dbname: user.dbname,
      owned: false,
    });
  });
  return (
    <QueryResult
      query={accounts}
      onLoading={<>Loading accounts...</>}
      onUndefined={<>No accounts found</>}
    >
      {(accounts) => {
        const groupedAccounts = groupBy(accounts, (account) => {
          return getAccountGroup(account, user.id);
        });
        const showTitle =
          Object.values(groupedAccounts).filter(
            (accounts) => accounts.length > 0
          ).length > 1;
        return (
          <>
            {groupedAccounts.owned && (
              <GroupedAccounts
                title="Owned"
                accounts={groupedAccounts.owned || []}
                user={user}
                showTitle={showTitle}
              />
            )}
            {groupedAccounts.common && (
              <GroupedAccounts
                title="Common"
                accounts={groupedAccounts.common || []}
                user={user}
                showTitle={showTitle}
              />
            )}
            {groupedAccounts.others && (
              <GroupedAccounts
                title="Others"
                accounts={groupedAccounts.others || []}
                user={user}
                showTitle={showTitle}
              />
            )}
          </>
        );
      }}
    </QueryResult>
  );
}

function DeleteButton(props: {
  onClick: MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <IconButton color="crimson" variant="ghost" onClick={props.onClick}>
      <Cross1Icon />
    </IconButton>
  );
}

type Partition = Unpacked<
  NonNullable<Awaited<ReturnType<typeof rpc.post.getPartitions>>>
>;

function PartitionLI({
  partition,
  user,
}: {
  partition: Partition;
  user: { id: string; dbname: string };
}) {
  const queryClient = useQueryClient();
  const [store, dispatch] = useContext(UserPageStoreContext);
  const [name, setName] = useState(partition.name);
  const deletePartition = useMutation(
    () => {
      return rpc.post.deletePartition({
        partitionId: partition.id,
        dbname: user.dbname,
        userId: user.id,
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["partitions", user.id, partition.account.id],
        });
        queryClient.invalidateQueries({
          queryKey: [
            "accountCanBeDeleted",
            { accountId: partition.account.id },
          ],
        });
      },
    }
  );
  const canBeDeleted = useQuery(
    ["partitionCanBeDeleted", { partitionId: partition.id }],
    () => {
      return rpc.post.partitionCanBeDeleted({
        partitionId: partition.id,
        dbname: user.dbname,
        userId: user.id,
      });
    }
  );
  const updatePartition = useMutation(
    (name: string) => {
      return rpc.post.updatePartition({
        partitionId: partition.id,
        dbname: user.dbname,
        userId: user.id,
        name,
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["partitions", user.id],
        });
      },
    }
  );
  const isSelected = store.partitionIds.includes(partition.id);
  const color = isSelected ? "cyan" : undefined;
  return (
    <Flex pr="2" justify="between">
      <Box grow="1">
        <Flex gap="1" align="center">
          <Checkbox
            mr="1"
            onClick={() => {
              dispatch({ type: "TOGGLE_PARTITIONS", payload: [partition.id] });
            }}
            checked={isSelected}
          />
          {/* TODO: Allow editing the partition. */}
          <Text
            align="center"
            color={color}
            weight={isSelected ? "medium" : "regular"}
          >
            {partition.name}
          </Text>
          {canBeDeleted.data && (
            <DeleteButton
              onClick={async (e) => {
                e.stopPropagation();
                await deletePartition.mutateAsync();
              }}
            />
          )}
        </Flex>
      </Box>
      <LoadingValue
        expect={(value) => value > 0}
        queryKey={[
          "partitionBalance",
          {
            partitionId: partition.id,
          },
        ]}
        valueLoader={() =>
          rpc.post.getPartitionBalance({
            partitionId: partition.id,
            userId: user.id,
            dbname: user.dbname,
          })
        }
      />
    </Flex>
  );
}

function Partitions(props: {
  accountId: string;
  user: { id: string; dbname: string };
}) {
  const { accountId, user } = props;
  const partitions = useQuery(["partitions", user.id, accountId], () => {
    return rpc.post.getPartitions({
      accountId,
      userId: user.id,
      dbname: user.dbname,
    });
  });
  return (
    <QueryResult
      query={partitions}
      onLoading={<>Loading partitions...</>}
      onUndefined={<>No partitions found</>}
    >
      {(partitions) => (
        <Box>
          {partitions.map((partition) => (
            <PartitionLI partition={partition} user={user} key={partition.id} />
          ))}
        </Box>
      )}
    </QueryResult>
  );
}

type Category = Awaited<
  ReturnType<typeof rpc.post.getUserCategories>
>["income"][number];

function Categories({ user }: { user: { id: string; dbname: string } }) {
  const queryClient = useQueryClient();
  const categories = useQuery(["categories", user.id], () => {
    return rpc.post.getUserCategories({ userId: user.id, dbname: user.dbname });
  });
  const [store, dispatch] = useContext(UserPageStoreContext);
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
        onLoading={<>Loading categories...</>}
        onUndefined={<>No categories found</>}
      >
        {(categories) => (
          <Flex direction="column" px="4">
            <Flex
              pr="2"
              justify="between"
              onClick={() => selectCategories("Income")}
            >
              <Text>Income</Text>
              <LoadingValue
                expect={(value) => value > 0}
                queryKey={["categoryKindBalance", "Income"]}
                valueLoader={() =>
                  rpc.post.getCategoryKindBalance({
                    kind: "Income",
                    userId: user.id,
                    dbname: user.dbname,
                  })
                }
              />
            </Flex>
            <Box mb="2">
              {categories.income.map((category) => (
                <Category key={category.id} category={category} user={user} />
              ))}
            </Box>
            <Flex
              pr="2"
              justify="between"
              onClick={() => selectCategories("Expense")}
            >
              <Text>Expense</Text>
              <LoadingValue
                expect={(value) => value < 0}
                queryKey={["categoryKindBalance", "Expense"]}
                valueLoader={() =>
                  rpc.post.getCategoryKindBalance({
                    kind: "Expense",
                    userId: user.id,
                    dbname: user.dbname,
                  })
                }
              />
            </Flex>
            <Box mb="2">
              {categories.expense.map((category) => (
                <Category key={category.id} category={category} user={user} />
              ))}
            </Box>
            <Flex
              pr="2"
              justify="between"
              onClick={() => selectCategories("Transfer")}
            >
              <Text>Transfer</Text>
              <LoadingValue
                expect={(value) => value === 0}
                queryKey={["categoryKindBalance", "Transfer"]}
                valueLoader={() =>
                  rpc.post.getCategoryKindBalance({
                    kind: "Transfer",
                    userId: user.id,
                    dbname: user.dbname,
                  })
                }
              />
            </Flex>
            <Box mb="2">
              {categories.transfer.map((category) => (
                <Category key={category.id} category={category} user={user} />
              ))}
            </Box>
          </Flex>
        )}
      </QueryResult>
    </>
  );
}

function Category({
  category,
  user,
}: {
  category: Category;
  user: { id: string; dbname: string };
}) {
  const queryClient = useQueryClient();
  const [store, dispatch] = useContext(UserPageStoreContext);
  const [name, setName] = useState(category.name);
  const canBeDeleted = useQuery(
    ["categoryCanBeDeleted", { categoryId: category.id }],
    () => {
      return rpc.post.categoryCanBeDeleted({
        categoryId: category.id,
        dbname: user.dbname,
        userId: user.id,
      });
    }
  );
  const deleteCategory = useMutation(
    () => {
      return rpc.post.deleteCategory({
        categoryId: category.id,
        dbname: user.dbname,
        userId: user.id,
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["categories", user.id] });
      },
    }
  );
  const updateCategory = useMutation((name: string) => {
    return rpc.post.updateCategory({
      categoryId: category.id,
      dbname: user.dbname,
      userId: user.id,
      name,
    });
  });
  const color = store.categoryIds.includes(category.id) ? "blue" : undefined;
  const isSelected = store.categoryIds.includes(category.id);
  return (
    <Flex justify="between" pr="2">
      <Flex gap="1" align="center">
        <Checkbox
          mr="1"
          onClick={() => {
            dispatch({ type: "TOGGLE_CATEGORIES", payload: [category.id] });
          }}
          checked={isSelected}
        />
        <Text align="center" color={color}>
          {category.name}
        </Text>
        {canBeDeleted.data && (
          <DeleteButton
            onClick={async (e) => {
              e.stopPropagation();
              await deleteCategory.mutateAsync();
            }}
          />
        )}
      </Flex>
      <LoadingValue
        expect={(value) => {
          if (category.kind === "Income") {
            return value > 0;
          } else if (category.kind === "Expense") {
            return value < 0;
          } else {
            return value === 0;
          }
        }}
        queryKey={[
          "categoryBalance",
          {
            categoryId: category.id,
          },
        ]}
        valueLoader={() =>
          rpc.post.getCategoryBalance({
            userId: user.id,
            categoryId: category.id,
            dbname: user.dbname,
          })
        }
      />
    </Flex>
  );
}

function DateRange({ user }: { user: { id: string; dbname: string } }) {
  const [store, dispatch] = useContext(UserPageStoreContext);
  return (
    <Flex direction="column" gap="1" px="4" py="2">
      <Flex justify="between">
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
      </Flex>
      <Flex justify="between">
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
      </Flex>
    </Flex>
  );
}

type Color = (typeof textPropDefs)["color"]["values"][number];

function LoadingValue(props: {
  expect: (value: number) => boolean;
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
        let color: Color | undefined;
        const asExpected = props.expect(parsedValue);
        if (!asExpected) {
          color = "red";
        }
        let result;
        if (isNaN(parsedValue)) {
          result = value;
        } else {
          result = formatValue(
            asExpected ? Math.abs(parsedValue) : parsedValue
          );
        }
        return <Text color={color}>{result}</Text>;
      }}
    </QueryResult>
  );
}
