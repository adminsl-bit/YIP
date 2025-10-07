import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SeedDemoUsers() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const navigate = useNavigate();

  const seedUsers = async () => {
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('seed-demo-users');

      if (error) throw error;

      setResult(data);
      toast.success('Demo users created successfully!');
    } catch (error: any) {
      console.error('Error seeding users:', error);
      toast.error(error.message || 'Failed to seed demo users');
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Seed Demo Users</h1>
            <p className="text-muted-foreground">
              Create demo users for all roles with username "demo" and password "1234"
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-2">Student</h3>
                <p className="text-muted-foreground">demo@student.yip / 1234</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-2">Admin Student</h3>
                <p className="text-muted-foreground">demo@admin.yip / 1234</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-2">Jury</h3>
                <p className="text-muted-foreground">demo@jury.yip / 1234</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-2">Organizer</h3>
                <p className="text-muted-foreground">demo@organizer.yip / 1234</p>
              </div>
            </div>

            <Button 
              onClick={seedUsers} 
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Users...
                </>
              ) : (
                'Create Demo Users'
              )}
            </Button>

            {result && (
              <div className="p-4 border rounded-lg">
                {result.error ? (
                  <div className="flex items-start gap-2 text-destructive">
                    <XCircle className="w-5 h-5 mt-0.5" />
                    <div>
                      <p className="font-semibold">Error</p>
                      <p className="text-sm">{result.error}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-5 h-5" />
                      <p className="font-semibold">Success!</p>
                    </div>
                    <div className="text-sm space-y-1">
                      {result.results?.map((r: any) => (
                        <p key={r.email} className="text-muted-foreground">
                          ✓ {r.email}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Button 
              variant="outline" 
              onClick={() => navigate('/login')}
              className="w-full"
            >
              Go to Login
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
