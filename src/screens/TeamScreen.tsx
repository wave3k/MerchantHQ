import type { SQLiteDatabase } from "expo-sqlite";

import { EmployeesScreen } from "./EmployeesScreen";
import type { ScreenKey, User } from "../types";

interface TeamScreenProps {
  db: SQLiteDatabase;
  user: User;
  onNavigate: (
    target: ScreenKey,
    params?: { userId?: number; employeeId?: number },
  ) => void;
}

export function TeamScreen({ db, user, onNavigate }: TeamScreenProps) {
  return <EmployeesScreen db={db} onNavigate={onNavigate} user={user} />;
}