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

  const downloadImageFromUrl = async (url: string): Promise<File> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch image');
    
    const blob = await response.blob();
    const filename = `photo_${Date.now()}.jpg`;
    return new File([blob], filename, { type: blob.type || 'image/jpeg' });
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

    let completed = 0;
    const total = studentsWithGooglePhotos.length;

    for (const student of studentsWithGooglePhotos) {
      try {
        // Convert Google Drive URL to direct download format
        let downloadUrl = student.photo_url!;
        if (downloadUrl.includes('/file/d/')) {
          const fileId = downloadUrl.split('/d/')[1]?.split('/')[0];
          downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        } else if (downloadUrl.includes('uc?export=view&id=')) {
          downloadUrl = downloadUrl.replace('uc?export=view&id=', 'uc?export=download&id=');
        }

        // Download the image
        const imageFile = await downloadImageFromUrl(downloadUrl);
        
        // Upload to Supabase Storage
        const fileExt = 'jpg';
        const fileName = `${student.serial_number}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('student-photos')
          .upload(fileName, imageFile, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('student-photos')
          .getPublicUrl(fileName);

        // Update the photo_url in database
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ photo_url: publicUrl })
          .eq('id', student.id);

        if (updateError) throw updateError;

        completed++;
        setMigrationProgress((completed / total) * 100);

      } catch (error) {
        console.error(`Failed to migrate photo for ${student.name}:`, error);
      }
    }

    setMigrationStatus('completed');
    toast({
      title: 'Migration Complete',
      description: `Successfully migrated ${completed} out of ${total} photos`,
    });

    await fetchStudents();
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
                      <img 
                        src={student.photo_url} 
                        alt={student.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-gray-400" />
                    )}
                    <div className="hidden text-xs text-gray-500">No Image</div>
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