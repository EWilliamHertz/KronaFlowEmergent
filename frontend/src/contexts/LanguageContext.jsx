import { createContext, useContext, useState } from 'react';

const translations = {
  en: {
    nav: {
      dashboard: 'Dashboard', transactions: 'Transactions', budgets: 'Budgets',
      assets: 'Assets', debts: 'Debts', settings: 'Settings',
    },
    dashboard: {
      title: 'Dashboard', totalBalance: 'Total Balance', monthlyIncome: 'Monthly Income',
      monthlyExpenses: 'Monthly Expenses', netWorth: 'Net Worth',
      recentTransactions: 'Recent Transactions', incomeVsExpenses: 'Income vs Expenses',
      budgetOverview: 'Budget Overview', quickActions: 'Quick Actions',
      aiInsights: 'AI Insights', getInsights: 'Get AI Insights',
    },
    transactions: {
      title: 'Transactions', addTransaction: 'Add Transaction', income: 'Income',
      expense: 'Expense', all: 'All', category: 'Category', amount: 'Amount',
      date: 'Date', description: 'Description', party: 'Party',
      noTransactions: 'No transactions found', statistics: 'Statistics',
      editTransaction: 'Edit Transaction',
    },
    budgets: {
      title: 'Budgets', createBudget: 'Create Budget', editBudget: 'Edit Budget',
      allocated: 'Allocated', spent: 'Spent', remaining: 'Remaining',
      noBudgets: 'No budgets. Create one to start tracking.',
      selectMonth: 'Select Month',
    },
    assets: {
      title: 'Assets', addAsset: 'Add Asset', editAsset: 'Edit Asset',
      currentValue: 'Current Value', purchaseValue: 'Purchase Value',
      gainLoss: 'Gain / Loss', all: 'All', stock: 'Stocks', crypto: 'Crypto',
      real_estate: 'Real Estate', vehicle: 'Vehicles', collectible: 'Collectibles', other: 'Other',
      noAssets: 'No assets tracked yet.',
    },
    debts: {
      title: 'Debts', addDebt: 'Add Debt', editDebt: 'Edit Debt',
      totalDebt: 'Total Debt', monthlyPayments: 'Monthly Payments',
      interestRate: 'Avg. Interest', makePayment: 'Make Payment',
      calculator: 'Debt Calculator', noDebts: 'No debts tracked.',
      paymentHistory: 'Payment History',
    },
    settings: {
      title: 'Settings', profile: 'Profile', name: 'Full Name', email: 'Email',
      organization: 'Organization', language: 'Language', currency: 'Currency',
      saveChanges: 'Save Changes', security: 'Security', preferences: 'Preferences',
      import: 'Import',
    },
    common: {
      save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', add: 'Add',
      create: 'Create', loading: 'Loading...', noData: 'No data available',
      error: 'An error occurred', success: 'Success', confirm: 'Confirm',
      close: 'Close', search: 'Search...', logout: 'Log Out', login: 'Log In',
      register: 'Register', or: 'or', sek: 'SEK',
    },
    categories: {
      food: 'Food', transport: 'Transport', housing: 'Housing',
      entertainment: 'Entertainment', healthcare: 'Healthcare', shopping: 'Shopping',
      utilities: 'Utilities', education: 'Education', salary: 'Salary',
      freelance: 'Freelance', investment: 'Investment', gift: 'Gift', other: 'Other',
    },
  },
  sv: {
    nav: {
      dashboard: 'Instrumentpanel', transactions: 'Transaktioner', budgets: 'Budgetar',
      assets: 'Tillgångar', debts: 'Skulder', settings: 'Inställningar',
    },
    dashboard: {
      title: 'Instrumentpanel', totalBalance: 'Totalt saldo', monthlyIncome: 'Månadsinkomst',
      monthlyExpenses: 'Månatliga utgifter', netWorth: 'Nettovärde',
      recentTransactions: 'Senaste transaktioner', incomeVsExpenses: 'Inkomst vs utgifter',
      budgetOverview: 'Budgetöversikt', quickActions: 'Snabbåtgärder',
      aiInsights: 'AI-insikter', getInsights: 'Hämta AI-insikter',
    },
    transactions: {
      title: 'Transaktioner', addTransaction: 'Lägg till transaktion', income: 'Inkomst',
      expense: 'Utgift', all: 'Alla', category: 'Kategori', amount: 'Belopp',
      date: 'Datum', description: 'Beskrivning', party: 'Part',
      noTransactions: 'Inga transaktioner hittades', statistics: 'Statistik',
      editTransaction: 'Redigera transaktion',
    },
    budgets: {
      title: 'Budgetar', createBudget: 'Skapa budget', editBudget: 'Redigera budget',
      allocated: 'Tilldelad', spent: 'Spenderat', remaining: 'Återstående',
      noBudgets: 'Inga budgetar. Skapa en för att börja spåra.',
      selectMonth: 'Välj månad',
    },
    assets: {
      title: 'Tillgångar', addAsset: 'Lägg till tillgång', editAsset: 'Redigera tillgång',
      currentValue: 'Nuvarande värde', purchaseValue: 'Inköpsvärde',
      gainLoss: 'Vinst / förlust', all: 'Alla', stock: 'Aktier', crypto: 'Krypto',
      real_estate: 'Fastigheter', vehicle: 'Fordon', collectible: 'Samlarobjekt', other: 'Övrigt',
      noAssets: 'Inga tillgångar spårade ännu.',
    },
    debts: {
      title: 'Skulder', addDebt: 'Lägg till skuld', editDebt: 'Redigera skuld',
      totalDebt: 'Total skuld', monthlyPayments: 'Månadsbetalningar',
      interestRate: 'Avg. ränta', makePayment: 'Gör betalning',
      calculator: 'Skuldkalkylator', noDebts: 'Inga skulder spårade.',
      paymentHistory: 'Betalningshistorik',
    },
    settings: {
      title: 'Inställningar', profile: 'Profil', name: 'Fullständigt namn', email: 'E-post',
      organization: 'Organisation', language: 'Språk', currency: 'Valuta',
      saveChanges: 'Spara ändringar', security: 'Säkerhet', preferences: 'Inställningar',
      import: 'Importera',
    },
    common: {
      save: 'Spara', cancel: 'Avbryt', delete: 'Ta bort', edit: 'Redigera',
      add: 'Lägg till', create: 'Skapa', loading: 'Laddar...', noData: 'Inga data tillgängliga',
      error: 'Ett fel inträffade', success: 'Framgång', confirm: 'Bekräfta',
      close: 'Stäng', search: 'Sök...', logout: 'Logga ut', login: 'Logga in',
      register: 'Registrera', or: 'eller', sek: 'SEK',
    },
    categories: {
      food: 'Mat', transport: 'Transport', housing: 'Boende',
      entertainment: 'Underhållning', healthcare: 'Hälsa', shopping: 'Shopping',
      utilities: 'Tjänster', education: 'Utbildning', salary: 'Lön',
      freelance: 'Frilans', investment: 'Investering', gift: 'Gåva', other: 'Övrigt',
    },
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en');

  const t = (key) => {
    const keys = key.split('.');
    let result = translations[language];
    for (const k of keys) {
      result = result?.[k];
    }
    return result || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
