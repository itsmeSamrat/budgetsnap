import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface QueryRequest {
  preset?: 'groceries_30d' | 'top_category_this_month' | 'net_this_month_vs_last';
  text?: string;
}

interface QueryResponse {
  answerText: string;
  data?: any;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return new Response('Missing Authorization header', { status: 401, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const jwt = authorization.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(jwt);
    
    if (authError || !user) {
      return new Response('Invalid authorization token', { status: 401, headers: corsHeaders });
    }

    const { preset, text }: QueryRequest = await req.json();

    let response: QueryResponse;

    if (preset) {
      response = await handlePresetQuery(supabaseClient, user.id, preset);
    } else if (text) {
      response = await handleTextQuery(supabaseClient, user.id, text);
    } else {
      return new Response('Either preset or text query required', { status: 400, headers: corsHeaders });
    }

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Query error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function handlePresetQuery(supabaseClient: any, userId: string, preset: string): Promise<QueryResponse> {
  const now = new Date();
  
  switch (preset) {
    case 'groceries_30d':
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const { data: groceries } = await supabaseClient
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('category', 'Groceries')
        .eq('type', 'debit')
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

      const total = groceries?.reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0) || 0;
      return {
        answerText: `You've spent $${total.toFixed(2)} on groceries in the last 30 days.`,
        data: { amount: total, period: '30 days', category: 'Groceries' }
      };

    case 'top_category_this_month':
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const { data: categories } = await supabaseClient
        .from('transactions')
        .select('category, amount')
        .eq('user_id', userId)
        .eq('type', 'debit')
        .gte('date', startOfMonth.toISOString().split('T')[0]);

      const categoryTotals = categories?.reduce((acc: any, t: any) => {
        acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount);
        return acc;
      }, {}) || {};

      const topCategory = Object.entries(categoryTotals).sort(([,a]: any, [,b]: any) => b - a)[0];
      
      if (topCategory) {
        return {
          answerText: `Your top spending category this month is ${topCategory[0]} with $${topCategory[1].toFixed(2)}.`,
          data: { category: topCategory[0], amount: topCategory[1] }
        };
      }
      return { answerText: "No transactions found for this month." };

    case 'net_this_month_vs_last':
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      const [{ data: thisMonth }, { data: lastMonth }] = await Promise.all([
        supabaseClient
          .from('transactions')
          .select('amount, type')
          .eq('user_id', userId)
          .gte('date', thisMonthStart.toISOString().split('T')[0]),
        supabaseClient
          .from('transactions')
          .select('amount, type')
          .eq('user_id', userId)
          .gte('date', lastMonthStart.toISOString().split('T')[0])
          .lte('date', lastMonthEnd.toISOString().split('T')[0])
      ]);

      const thisMonthNet = calculateNet(thisMonth || []);
      const lastMonthNet = calculateNet(lastMonth || []);
      const difference = thisMonthNet - lastMonthNet;

      return {
        answerText: `This month's net is $${thisMonthNet.toFixed(2)} vs last month's $${lastMonthNet.toFixed(2)} (${difference >= 0 ? '+' : ''}$${difference.toFixed(2)}).`,
        data: { thisMonth: thisMonthNet, lastMonth: lastMonthNet, difference }
      };

    default:
      return { answerText: "Unknown preset query." };
  }
}

async function handleTextQuery(supabaseClient: any, userId: string, text: string): Promise<QueryResponse> {
  const lower = text.toLowerCase();

  // Pattern: "how much did I spend on [category] in [month]"
  const categoryMatch = lower.match(/how much.*on (\w+) in (\w+)/);
  if (categoryMatch) {
    const category = categoryMatch[1];
    const month = monthNameToNumber(categoryMatch[2]);
    
    if (month !== -1) {
      const year = new Date().getFullYear();
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);

      const { data: transactions } = await supabaseClient
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .ilike('category', `%${category}%`)
        .eq('type', 'debit')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      const total = transactions?.reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0) || 0;
      return {
        answerText: `You spent $${total.toFixed(2)} on ${category} in ${categoryMatch[2]}.`,
        data: { amount: total, category, month: categoryMatch[2] }
      };
    }
  }

  // Pattern: "total spend last [X] days"
  const daysMatch = lower.match(/total spend last (\d+) days/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1]);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const { data: transactions } = await supabaseClient
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'debit')
      .gte('date', startDate.toISOString().split('T')[0]);

    const total = transactions?.reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0) || 0;
    return {
      answerText: `You spent $${total.toFixed(2)} in the last ${days} days.`,
      data: { amount: total, days }
    };
  }

  return { answerText: "I don't understand that query. Try asking about spending on specific categories or time periods." };
}

function calculateNet(transactions: any[]): number {
  return transactions.reduce((net, t) => {
    const amount = parseFloat(t.amount);
    return t.type === 'credit' ? net + amount : net - amount;
  }, 0);
}

function monthNameToNumber(monthName: string): number {
  const months = {
    january: 0, jan: 0,
    february: 1, feb: 1,
    march: 2, mar: 2,
    april: 3, apr: 3,
    may: 4,
    june: 5, jun: 5,
    july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    october: 9, oct: 9,
    november: 10, nov: 10,
    december: 11, dec: 11
  };
  
  return months[monthName.toLowerCase()] ?? -1;
}