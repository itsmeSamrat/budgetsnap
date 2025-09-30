export function isSameDayStr(a: string, b: string): boolean {
  return a === b;
}

export function formatMoney(amount: number, type: 'income' | 'expense'): string {
  const abs = Math.abs(amount);
  const formatted = abs.toFixed(2);
  return type === 'expense' ? `-$${formatted}` : `+$${formatted}`;
}

export function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDisplayDate(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getMonthName(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function getStartOfMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

export function getEndOfMonth(year: number, month: number): string {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

export function getMonthGrid(year: number, month: number): Array<{ date: Date; dateStr: string; isCurrentMonth: boolean }> {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const firstDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const grid: Array<{ date: Date; dateStr: string; isCurrentMonth: boolean }> = [];

  const leadingDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  for (let i = leadingDays; i > 0; i--) {
    const date = new Date(year, month, 1 - i);
    grid.push({
      date,
      dateStr: getLocalDateString(date),
      isCurrentMonth: false
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    grid.push({
      date,
      dateStr: getLocalDateString(date),
      isCurrentMonth: true
    });
  }

  const remainingCells = 42 - grid.length;
  for (let i = 1; i <= remainingCells; i++) {
    const date = new Date(year, month + 1, i);
    grid.push({
      date,
      dateStr: getLocalDateString(date),
      isCurrentMonth: false
    });
  }

  return grid;
}

export function getTodayString(): string {
  return getLocalDateString(new Date());
}
