import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, RefreshCw, CheckCircle, AlertCircle, Image as ImageIcon } from 'lucide-react';

interface Student {
  id: string;
  serial_number: number;
  name: string;
  photo_url?: string;
}

const PhotoUploadManager = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const { toast } = useToast();

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, serial_number, name, photo_url')
        .eq('user_type', 'student')
        .order('serial_number');

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch students',
        variant: 'destructive',
      });
    }
  };

  const handleFileUpload = async (file: File, studentId: string, serialNumber: number) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${serialNumber}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('student-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('student-photos')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ photo_url: publicUrl })
        .eq('id', studentId);

      if (updateError) throw updateError;

      toast({
        title: 'Success',
        description: 'Photo uploaded successfully',
      });

      await fetchStudents();
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload photo',
        variant: 'destructive',
      });
    }
  };

  const migrateGoogleDrivePhotos = async () => {
    setMigrationStatus('running');
    setMigrationProgress(0);

    const studentsWithGooglePhotos = students.filter(s => 
      s.photo_url && s.photo_url.includes('drive.google.com')
    );

    if (studentsWithGooglePhotos.length === 0) {
      toast({
        title: 'No Migration Needed',
        description: 'No Google Drive photos found to migrate',
      });
      setMigrationStatus('idle');
      return;
    }

    try {
      toast({
        title: 'Migration Started',
        description: `Starting migration of ${studentsWithGooglePhotos.length} photos...`,
      });

      // Call the edge function to start migration
      const { data, error } = await supabase.functions.invoke('migrate-photos', {
        body: {}
      });

      if (error) {
        throw error;
      }

      const result = data;
      
      if (result.success) {
        setMigrationProgress(100);
        setMigrationStatus('completed');
        
        toast({
          title: 'Migration Started Successfully',
          description: `${result.message}. The migration is running in the background. Photos will appear as they complete.`,
        });

        // Start polling to refresh the student list periodically
        const pollInterval = setInterval(async () => {
          await fetchStudents();
          
          // Check if migration is complete by counting remaining Google Drive photos
          const remainingGooglePhotos = students.filter(s => 
            s.photo_url && s.photo_url.includes('drive.google.com')
          ).length;
          
          if (remainingGooglePhotos === 0) {
            clearInterval(pollInterval);
            toast({
              title: 'Migration Complete',
              description: 'All photos have been successfully migrated to Supabase Storage!',
            });
          }
        }, 3000); // Check every 3 seconds

        // Clear interval after 5 minutes to avoid infinite polling
        setTimeout(() => {
          clearInterval(pollInterval);
        }, 300000);

      } else {
        throw new Error(result.error || 'Migration failed');
      }

    } catch (error) {
      setMigrationStatus('error');
      console.error('Migration failed:', error);
      toast({
        title: 'Migration Failed',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  };

  React.useEffect(() => {
    fetchStudents();
  }, []);

  const googleDriveCount = students.filter(s => 
    s.photo_url && s.photo_url.includes('drive.google.com')
  ).length;

  const supabaseCount = students.filter(s => 
    s.photo_url && s.photo_url.includes('supabase.co')
  ).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Photo Migration Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{students.length}</div>
              <div className="text-sm text-blue-700">Total Students</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{googleDriveCount}</div>
              <div className="text-sm text-orange-700">Google Drive Photos</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{supabaseCount}</div>
              <div className="text-sm text-green-700">Supabase Photos</div>
            </div>
          </div>

          {googleDriveCount > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Migrate Google Drive Photos</h3>
                  <p className="text-sm text-muted-foreground">
                    Move {googleDriveCount} photos from Google Drive to Supabase Storage for better performance and reliability
                  </p>
                </div>
                <Button 
                  onClick={migrateGoogleDrivePhotos}
                  disabled={migrationStatus === 'running'}
                  className="flex items-center gap-2"
                >
                  {migrationStatus === 'running' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {migrationStatus === 'running' ? 'Migrating...' : 'Migrate Photos'}
                </Button>
              </div>

              {migrationStatus === 'running' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Migration Progress</span>
                    <span>{Math.round(migrationProgress)}%</span>
                  </div>
                  <Progress value={migrationProgress} className="w-full" />
                </div>
              )}

              {migrationStatus === 'completed' && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">Migration completed successfully!</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Individual Photo Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {students.map((student) => (
              <div key={student.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                    {student.photo_url ? (
                      <>
                        <img 
                          src={student.photo_url} 
                          alt={student.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              const fallback = parent.querySelector('.fallback-icon') as HTMLElement;
                              const noImageText = parent.querySelector('.no-image-text') as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                              if (noImageText) noImageText.style.display = 'block';
                            }
                          }}
                        />
                        <div className="fallback-icon hidden w-full h-full items-center justify-center flex-col">
                          <ImageIcon className="w-6 h-6 text-gray-400" />
                          <div className="no-image-text text-xs text-gray-500 mt-1">Failed</div>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center flex-col">
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                        <div className="text-xs text-gray-500 mt-1">No Image</div>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{student.name}</div>
                    <div className="text-sm text-muted-foreground">Serial: {student.serial_number}</div>
                    {student.photo_url && (
                      <div className="text-xs text-muted-foreground">
                        {student.photo_url.includes('drive.google.com') ? 'Google Drive' : 'Supabase Storage'}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileUpload(file, student.id, student.serial_number);
                      }
                    }}
                    className="w-48"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PhotoUploadManager;