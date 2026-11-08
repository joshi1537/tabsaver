import { createClient } from "@supabase/supabase-js";
 
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);
 
export type Link = {
  id: string;
  url: string;
  title: string | null;
  category: string;
  status: "todo" | "done";
  due_date: string | null;
  created_at: string;
};
 