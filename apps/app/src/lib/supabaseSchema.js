export const PROFILE_RLS_FIX_SQL = `
/*
  FIX FOR INFINITE RECURSION IN PROFILES RLS
  ==========================================
  
  ISSUE:
  The error "infinite recursion detected in policy for relation profiles" occurs when a Row Level Security (RLS) 
  policy on the 'profiles' table attempts to query the 'profiles' table itself (e.g., to check if the current user 
  has an 'admin' role). This creates a circular dependency:
  Query Profiles -> Check Policy -> Query Profiles (to check role) -> Check Policy -> ...

  SOLUTION:
  To break this cycle, we must use a "SECURITY DEFINER" function. 
  
  A SECURITY DEFINER function runs with the privileges of the user who created it (usually the database owner/admin), 
  NOT the user executing the query. This allows the function to bypass the RLS policy on the 'profiles' table 
  while checking the user's role, preventing the recursion.

  INSTRUCTIONS:
  Run the following SQL in your Supabase SQL Editor to apply the fix.
*/

-- 1. Create a secure function to check if the current user is an admin
-- This function runs as the database owner, bypassing RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the problematic policy (adjust the name if your policy is named differently)
-- Common names might be "Admins can view all profiles" or "Enable read access for admins"
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- 3. Create the new policy using the secure function
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
  public.is_admin()
);

-- 4. Ensure users can always see their own profile (this usually doesn't cause recursion, but is required)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id
);

-- 5. (Optional) Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
`;