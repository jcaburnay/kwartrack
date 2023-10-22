import { useReducer, createContext, ReactNode } from "react";

type UserPageStore = {
  partitionIds: string[];
  categoryIds: string[];
  loanIds: string[];
  tssDate: Date | null;
  tseDate: Date | null;
  nPerPage: number;
  currentPage: number;
  selectedCategoryId: string;
  selectedSourceId: string;
  selectedDestinationId: string;
};

type UserPageAction =
  | { type: "TOGGLE_PARTITIONS"; payload: string[] }
  | { type: "TOGGLE_ACCOUNT"; payload: string[] }
  | { type: "TOGGLE_CATEGORIES"; payload: string[] }
  | { type: "TOGGLE_CATEGORY_KIND"; payload: string[] }
  | { type: "SET_N_PER_PAGE"; payload: number }
  | { type: "SET_TSS_DATE"; payload: Date | null }
  | { type: "SET_TSE_DATE"; payload: Date | null }
  | { type: "SET_THIS_MONTH" }
  | { type: "SET_PREV_MONTH" }
  | { type: "SET_NEXT_MONTH" }
  | { type: "SET_SELECTED_CATEGORY_ID"; payload: string }
  | { type: "SET_SELECTED_SOURCE_ID"; payload: string }
  | { type: "SET_SELECTED_DESTINATION_ID"; payload: string }
  | { type: "TOGGLE_LOAN_IDS"; payload: string[] }
  | { type: "REMOVE_LOAN_IDS"; payload: string[] }
  | { type: "SET_CURRENT_PAGE"; payload: number };

type UserPageDispatch = (action: UserPageAction) => void;

const getFirstDayOfMonth = (date: Date) => {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1));
};

const getLastDayOfMonth = (date: Date) => {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth() + 1, 0));
};

const plusMonths = (date: Date, n: number) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return new Date(d);
};

const initStore: UserPageStore = {
  partitionIds: [],
  categoryIds: [],
  loanIds: [],
  nPerPage: 25,
  currentPage: 1,
  tssDate: getFirstDayOfMonth(new Date()),
  tseDate: getLastDayOfMonth(new Date()),
  selectedCategoryId: "",
  selectedSourceId: "",
  selectedDestinationId: "",
};

const userPageStoreReducer = (
  state: UserPageStore,
  action: UserPageAction
): UserPageStore => {
  switch (action.type) {
    case "TOGGLE_PARTITIONS": {
      let partitionIds = state.partitionIds;
      for (const id of action.payload) {
        if (partitionIds.includes(id)) {
          partitionIds = partitionIds.filter((_id) => _id !== id);
        } else {
          partitionIds = [...partitionIds, id];
        }
      }
      return { ...state, partitionIds, selectedSourceId: "", currentPage: 1 };
    }
    case "TOGGLE_ACCOUNT": {
      // payload is partitionIds in the clicked account
      let allSelected = true;
      for (const id of action.payload) {
        if (!state.partitionIds.includes(id)) {
          allSelected = false;
          break;
        }
      }
      if (allSelected) {
        return {
          ...state,
          partitionIds: state.partitionIds.filter(
            (id) => !action.payload.includes(id)
          ),
          currentPage: 1,
        };
      } else {
        return {
          ...state,
          partitionIds: [...state.partitionIds, ...action.payload],
          currentPage: 1,
        };
      }
    }
    case "TOGGLE_CATEGORIES": {
      let categoryIds = state.categoryIds;
      for (const id of action.payload) {
        if (categoryIds.includes(id)) {
          categoryIds = categoryIds.filter((_id) => _id !== id);
        } else {
          categoryIds = [...categoryIds, id];
        }
      }
      return { ...state, categoryIds, selectedCategoryId: "", currentPage: 1 };
    }
    case "TOGGLE_CATEGORY_KIND": {
      let allSelected = true;
      for (const id of action.payload) {
        if (!state.categoryIds.includes(id)) {
          allSelected = false;
          break;
        }
      }
      if (allSelected) {
        return {
          ...state,
          categoryIds: state.categoryIds.filter(
            (id) => !action.payload.includes(id)
          ),
          currentPage: 1,
        };
      } else {
        return {
          ...state,
          categoryIds: [...state.categoryIds, ...action.payload],
          currentPage: 1,
        };
      }
    }
    case "SET_N_PER_PAGE": {
      return { ...state, nPerPage: action.payload };
    }
    case "SET_TSS_DATE": {
      return { ...state, tssDate: action.payload, currentPage: 1 };
    }
    case "SET_TSE_DATE": {
      return { ...state, tseDate: action.payload, currentPage: 1 };
    }
    case "SET_THIS_MONTH": {
      const today = new Date();
      return {
        ...state,
        tssDate: getFirstDayOfMonth(today),
        tseDate: getLastDayOfMonth(today),
        currentPage: 1,
      };
    }
    case "SET_PREV_MONTH": {
      const d = state.tssDate || new Date();
      const x = plusMonths(d, -1);
      return {
        ...state,
        tssDate: getFirstDayOfMonth(x),
        tseDate: getLastDayOfMonth(x),
        currentPage: 1,
      };
    }
    case "SET_NEXT_MONTH": {
      const d = state.tssDate || new Date();
      const x = plusMonths(d, 1);
      return {
        ...state,
        tssDate: getFirstDayOfMonth(x),
        tseDate: getLastDayOfMonth(x),
        currentPage: 1,
      };
    }
    case "SET_SELECTED_CATEGORY_ID": {
      return { ...state, selectedCategoryId: action.payload };
    }
    case "SET_SELECTED_SOURCE_ID": {
      return { ...state, selectedSourceId: action.payload };
    }
    case "SET_SELECTED_DESTINATION_ID": {
      return { ...state, selectedDestinationId: action.payload };
    }
    case "TOGGLE_LOAN_IDS": {
      let loanIds = state.loanIds;
      for (const id of action.payload) {
        if (loanIds.includes(id)) {
          loanIds = loanIds.filter((_id) => _id !== id);
        } else {
          loanIds = [...loanIds, id];
        }
      }
      return { ...state, loanIds, currentPage: 1 };
    }
    case "REMOVE_LOAN_IDS": {
      return {
        ...state,
        loanIds: state.loanIds.filter((id) => !action.payload.includes(id)),
        currentPage: 1,
      };
    }
    case "SET_CURRENT_PAGE": {
      return { ...state, currentPage: action.payload };
    }
  }
};

export const UserPageStoreContext = createContext<
  [state: UserPageStore, dispatch: UserPageDispatch]
>([initStore, () => null]);

export const UserPageStoreProvider = (props: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(userPageStoreReducer, initStore);
  return (
    <UserPageStoreContext.Provider value={[state, dispatch]}>
      {props.children}
    </UserPageStoreContext.Provider>
  );
};