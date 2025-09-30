export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
}

export function parseReceiptText(ocrText: string): ParsedTransaction {
  const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  console.log('Parsing receipt with lines:', lines);
  
  const date = extractDate(ocrText);
  console.log('Extracted date:', date);
  const amount = extractAmount(ocrText, lines);
  console.log('Extracted amount:', amount);
  const description = extractMerchant(lines, ocrText);
  console.log('Extracted merchant:', description);
  const type = extractType(ocrText);
  console.log('Extracted type:', type);

  return {
    date,
    description,
    amount,
    type
  };
}

function extractDate(text: string): string {
  const datePatterns = [
    // Bank app format: "Fri, Sep 19, 2025" or "Sep 19, 2025"
    /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
    // Standard formats
    /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/g,
    /\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/g,
    // DD MMM YYYY
    /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/gi
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      const dateStr = match[0];
      console.log('Found date match:', dateStr);
      
      // Handle bank app format
      if (dateStr.includes('Sep') || dateStr.includes('Jan') || dateStr.includes('Feb') || 
          dateStr.includes('Mar') || dateStr.includes('Apr') || dateStr.includes('May') ||
          dateStr.includes('Jun') || dateStr.includes('Jul') || dateStr.includes('Aug') ||
          dateStr.includes('Oct') || dateStr.includes('Nov') || dateStr.includes('Dec')) {
        
        const monthMap: { [key: string]: string } = {
          'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
          'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
          'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        };
        
        // Extract month, day, year from formats like "Fri, Sep 19, 2025" or "Sep 19, 2025"
        const monthMatch = dateStr.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i);
        if (monthMatch) {
          const month = monthMap[monthMatch[1]];
          const day = monthMatch[2].padStart(2, '0');
          const year = monthMatch[3];
          return `${year}-${month}-${day}`;
        }
      }
      
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }
  }

  // Default to today if no date found
  return new Date().toISOString().split('T')[0];
}

function extractAmount(text: string, lines: string[]): number {
  // Look for currency amounts in bank transaction format
  const currencyPatterns = [
    // $83.09 format (most common in bank apps)
    /\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
    // Other currency symbols
    /[€£¥₹₽](\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g
  ];

  const amounts: number[] = [];

  // First, look for currency-prefixed amounts
  for (const pattern of currencyPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const amountStr = match[1].replace(/,/g, '');
      const amount = parseFloat(amountStr);
      if (!isNaN(amount) && amount > 0) {
        amounts.push(amount);
        console.log('Found currency amount:', amount);
      }
    }
  }

  // If we found currency amounts, return the largest one
  if (amounts.length > 0) {
    return Math.max(...amounts);
  }

  // Fallback: look for total lines
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('total') || 
        lowerLine.includes('amount') ||
        lowerLine.includes('balance')) {
      const amount = extractNumberFromLine(line);
      if (amount > 0) {
        console.log('Found total line amount:', amount);
        return amount;
      }
    }
  }

  // Last resort: find all numbers and return the largest reasonable one
  const numbers = extractAllNumbers(text);
  const reasonableAmounts = numbers.filter(n => n > 0 && n < 100000); // Filter out years, phone numbers, etc.
  
  if (reasonableAmounts.length > 0) {
    const maxAmount = Math.max(...reasonableAmounts);
    console.log('Found fallback amount:', maxAmount);
    return maxAmount;
  }

  return 0;
}

function extractNumberFromLine(line: string): number {
  // Remove currency symbols and normalize
  const cleaned = line.replace(/[$€£¥₹₽]/g, '')
                     .replace(/,/g, '')
                     .replace(/\s+/g, ' ');
  
  // Find decimal numbers
  const numberMatch = cleaned.match(/(\d+\.?\d*)/);
  if (numberMatch) {
    return parseFloat(numberMatch[1]);
  }
  
  return 0;
}

function extractAllNumbers(text: string): number[] {
  const cleaned = text.replace(/[$€£¥₹₽]/g, '')
                     .replace(/,/g, '');
  
  const matches = cleaned.match(/\d+\.?\d*/g);
  if (!matches) return [];
  
  return matches
    .map(match => parseFloat(match))
    .filter(num => !isNaN(num) && num > 0);
}

function extractMerchant(lines: string[], fullText: string): string {
  // For bank transactions, look for merchant names in specific patterns
  
  // Look for common merchant patterns in bank apps
  const merchantPatterns = [
    // Amazon, Walmart, etc. - standalone merchant names
    /^(Amazon|Walmart|Costco|Target|Starbucks|McDonald|Tim Hortons|Uber|Lyft|Netflix|Spotify|Apple|Google|Microsoft|PayPal)$/i,
    // Merchant names followed by location or details
    /(Amazon|Walmart|Costco|Target|Starbucks|McDonald|Tim Hortons|Uber|Lyft|Netflix|Spotify|Apple|Google|Microsoft|PayPal)\s+/i
  ];

  // Check each line for merchant patterns
  for (const line of lines) {
    for (const pattern of merchantPatterns) {
      const match = line.match(pattern);
      if (match) {
        console.log('Found merchant pattern match:', match[1] || match[0]);
        return match[1] || match[0];
      }
    }
  }

  // Look for lines that appear to be merchant names (not generic terms)
  const candidateLines = lines.filter(line => {
    const lower = line.toLowerCase();
    return (
      line.length > 2 &&
      line.length < 50 && // Reasonable merchant name length
      /[a-zA-Z]/.test(line) &&
      !lower.includes('transaction') &&
      !lower.includes('details') &&
      !lower.includes('posted') &&
      !lower.includes('card number') &&
      !lower.includes('category') &&
      !lower.includes('budget') &&
      !lower.includes('note') &&
      !lower.includes('merchant') &&
      !lower.includes('website') &&
      !lower.includes('fri') && !lower.includes('mon') && !lower.includes('tue') &&
      !lower.includes('wed') && !lower.includes('thu') && !lower.includes('sat') && !lower.includes('sun') &&
      !/^\d+[\d\s\/\-.:*]*$/.test(line) && // Not just numbers/symbols
      !/^\$\d/.test(line) && // Not a price
      !line.includes('866-') && !line.includes('phone') // Not phone numbers
    );
  });

  console.log('Candidate merchant lines:', candidateLines);

  // Return the first reasonable candidate
  if (candidateLines.length > 0) {
    // Prefer shorter, cleaner names
    const sortedCandidates = candidateLines.sort((a, b) => a.length - b.length);
    return sortedCandidates[0];
  }

  return 'Unknown Merchant';
}

function extractType(text: string): 'debit' | 'credit' {
  const lower = text.toLowerCase();
  
  const creditIndicators = [
    'credited', 'refund', 'salary', 'payroll', 'deposit', 'bonus',
    'commission', 'dividend', 'interest', 'payment received', 'transfer in',
    'income', 'credit', 'received'
  ];

  for (const indicator of creditIndicators) {
    if (lower.includes(indicator)) {
      return 'credit';
    }
  }

  // Bank transactions are typically debits unless specified otherwise
  return 'debit';
}