import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Zap, CheckCircle, AlertCircle, Loader2, RefreshCw } from "lucide-react";

interface MigrationResult {
  success: boolean;
  message?: string;
  batch_size?: number;
  total_remaining?: number;
  error?: string;
}

const PhotoMigration = () => {
  const [migrating, setMigrating] = useState(false);
  const [migrationStats, setMigrationStats] = useState<{
    googleDrivePhotos: number;
    supabasePhotos: number;
  } | null>(null);
  const [lastResult, setLastResult] = useState<MigrationResult | null>(null);
  const { toast } = useToast();

  const fetchMigrationStats = async () => {
    try {
      const [googleDriveResult, supabaseResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id', { count: 'exact' })
          .like('photo_url', '%drive.google.com%'),
        supabase
          .from('profiles')
          .select('id', { count: 'exact' })
          .like('photo_url', '%supabase.co/storage%')
      ]);

      setMigrationStats({
        googleDrivePhotos: googleDriveResult.count || 0,
        supabasePhotos: supabaseResult.count || 0
      });
    } catch (error) {
      console.error('Error fetching migration stats:', error);
    }
  };

  const startMigration = async () => {
    setMigrating(true);
    setLastResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('migrate-photos', {
        body: {}
      });

      if (error) {
        throw error;
      }

      const result = data as MigrationResult;
      setLastResult(result);
      
      if (result.success) {
        toast({
          title: "Migration Started",
          description: result.message || "Photo migration is running in the background",
        });
        
        // Refresh stats after a short delay
        setTimeout(() => {
          fetchMigrationStats();
        }, 2000);
      } else {
        toast({
          title: "Migration Failed",
          description: result.error || "Failed to start photo migration",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Migration error:', error);
      toast({
        title: "Migration Error",
        description: error.message || "Failed to start photo migration",
        variant: "destructive",
      });
      setLastResult({
        success: false,
        error: error.message || "Failed to start photo migration"
      });
    } finally {
      setMigrating(false);
    }
  };

  // Fetch stats on component mount
  React.useEffect(() => {
    fetchMigrationStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* Migration Stats */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <Upload className="w-5 h-5 text-blue-600" />
            Photo Migration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="text-center p-4 bg-white/10 rounded-xl border border-white/20">
              <div className="text-2xl font-bold text-amber-600">
                {migrationStats?.googleDrivePhotos ?? '...'}
              </div>
              <div className="text-sm text-slate-600 font-medium">Google Drive Photos</div>
              <Badge variant="outline" className="mt-2 bg-amber-100/20 text-amber-700 border-amber-300/30">
                Needs Migration
              </Badge>
            </div>
            <div className="text-center p-4 bg-white/10 rounded-xl border border-white/20">
              <div className="text-2xl font-bold text-green-600">
                {migrationStats?.supabasePhotos ?? '...'}
              </div>
              <div className="text-sm text-slate-600 font-medium">Supabase Hosted Photos</div>
              <Badge variant="outline" className="mt-2 bg-green-100/20 text-green-700 border-green-300/30">
                Migrated
              </Badge>
            </div>
          </div>
          
          <div className="mt-4 flex justify-center">
            <Button
              onClick={fetchMigrationStats}
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/20 text-slate-700 hover:bg-white/20"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Stats
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Migration Control */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <Zap className="w-5 h-5 text-purple-600" />
            Batch Migration Control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50/20 border border-blue-200/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-slate-700">
                <p className="font-semibold mb-1">How it works:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li>Processes 5 photos per batch to avoid timeouts</li>
                  <li>Downloads from Google Drive and uploads to Supabase Storage</li>
                  <li>Run multiple times until all photos are migrated</li>
                  <li>Each batch takes ~30 seconds to complete</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
            <Button
              onClick={startMigration}
              disabled={migrating || (migrationStats?.googleDrivePhotos === 0)}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold px-6 py-3 shadow-lg"
            >
              {migrating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting Migration...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Migrate Photos (Batch)
                </>
              )}
            </Button>
          </div>

          {/* Last Result */}
          {lastResult && (
            <div className={`p-4 rounded-xl border ${
              lastResult.success 
                ? 'bg-green-50/20 border-green-200/30' 
                : 'bg-red-50/20 border-red-200/30'
            }`}>
              <div className="flex items-start gap-3">
                {lastResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className={`font-semibold ${
                    lastResult.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {lastResult.success ? 'Migration Started' : 'Migration Failed'}
                  </p>
                  <p className={`text-sm mt-1 ${
                    lastResult.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {lastResult.message || lastResult.error}
                  </p>
                  {lastResult.batch_size && lastResult.total_remaining && (
                    <div className="mt-2 flex gap-4 text-sm">
                      <Badge variant="outline" className="bg-white/20">
                        Batch: {lastResult.batch_size} photos
                      </Badge>
                      <Badge variant="outline" className="bg-white/20">
                        Remaining: {lastResult.total_remaining}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PhotoMigration;