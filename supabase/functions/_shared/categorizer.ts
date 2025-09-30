export interface CategoryMap {
  [key: string]: string[];
}

const CATEGORY_KEYWORDS: CategoryMap = {
  'Dining': [
    'starbucks', 'mcdonald', 'kfc', 'restaurant', 'cafe', 'ubereats', 'doordash',
    'pizza', 'burger', 'subway', 'tim hortons', 'wendy', 'taco bell', 'domino',
    'food', 'bar', 'pub', 'bistro', 'diner', 'grill'
  ],
  'Groceries': [
    'walmart', 'costco', 'no frills', 'loblaws', 'aldi', 'kroger', 'metro',
    'supermarket', 'grocery', 'food basics', 'sobeys', 'safeway', 'whole foods',
    'produce', 'market'
  ],
  'Transport': [
    'uber', 'lyft', 'gas', 'shell', 'esso', 'petro', 'bp', 'metro pass',
    'fuel', 'taxi', 'bus', 'transit', 'parking', 'toll', 'car wash',
    'vehicle', 'automotive'
  ],
  'Utilities': [
    'hydro', 'electric', 'water', 'gas bill', 'internet', 'rogers', 'bell',
    'verizon', 'phone', 'cable', 'utility', 'power', 'heating', 'cooling'
  ],
  'Rent': [
    'rent', 'landlord', 'property mgmt', 'lease', 'housing', 'apartment',
    'condo', 'mortgage'
  ],
  'Income': [
    'salary', 'payroll', 'deposit', 'credited', 'refund', 'transfer in',
    'bonus', 'commission', 'dividend', 'interest', 'payment received'
  ],
  'Shopping': [
    'amazon', 'target', 'best buy', 'clothing', 'shoes', 'electronics',
    'department store', 'mall', 'retail', 'purchase'
  ],
  'Healthcare': [
    'pharmacy', 'doctor', 'hospital', 'clinic', 'medical', 'dental',
    'prescription', 'health', 'insurance'
  ],
  'Entertainment': [
    'movie', 'theater', 'netflix', 'spotify', 'game', 'concert',
    'entertainment', 'streaming', 'subscription'
  ]
};

export function categorizeTransaction(description: string, type: 'debit' | 'credit'): string {
  const lowerDescription = description.toLowerCase();
  
  // If it's a credit transaction, check for income keywords first
  if (type === 'credit') {
    for (const keyword of CATEGORY_KEYWORDS['Income']) {
      if (lowerDescription.includes(keyword)) {
        return 'Income';
      }
    }
  }

  // Check all other categories
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === 'Income' && type !== 'credit') continue;
    
    for (const keyword of keywords) {
      if (lowerDescription.includes(keyword)) {
        return category;
      }
    }
  }

  return 'Uncategorized';
}

export function getAllCategories(): string[] {
  return Object.keys(CATEGORY_KEYWORDS);
}