import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, RefreshCw, CheckCircle, AlertCircle, Image as ImageIcon, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import heic2any from 'heic2any';

interface Student {
  id: string;
  serial_number: number;
  name: string;
  photo_url?: string;
  updated_at?: string;
}

const PhotoUploadManager = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Filter students based on search term
  React.useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredStudents(students);
    } else {
      const filtered = students.filter(student =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.serial_number.toString().includes(searchTerm)
      );
      setFilteredStudents(filtered);
    }
  }, [students, searchTerm]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, serial_number, name, photo_url, updated_at')
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
      console.log('Starting file upload for student:', serialNumber, 'File:', file.name, 'Type:', file.type);
      
      let processedFile = file;
      let fileName = `${serialNumber}.jpg`; // Always save as JPG

      // Convert HEIC to JPEG if needed
      if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
        console.log('Converting HEIC to JPEG...');
        toast({
          title: 'Converting HEIC',
          description: 'Converting HEIC image to JPEG format...',
        });

        const convertedBlob = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.8
        }) as Blob;

        processedFile = new File([convertedBlob], fileName, { type: 'image/jpeg' });
        console.log('HEIC conversion completed');
      }

      console.log('Uploading to storage bucket...');
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('student-photos')
        .upload(fileName, processedFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }

      console.log('Upload successful:', uploadData);

      const { data: { publicUrl } } = supabase.storage
        .from('student-photos')
        .getPublicUrl(fileName);

      const updatedUrl = `${publicUrl}?v=${Date.now()}`;
      console.log('Generated photo URL:', updatedUrl);

      console.log('Updating database...');
      const { error: updateError, data: updateData } = await supabase
        .from('profiles')
        .update({ photo_url: updatedUrl })
        .eq('id', studentId)
        .select();

      if (updateError) {
        console.error('Database update error:', updateError);
        throw updateError;
      }

      console.log('Database update successful:', updateData);

      toast({
        title: 'Success',
        description: `Photo uploaded successfully for student ${serialNumber}`,
      });

      await fetchStudents();
      console.log('Students list refreshed');
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: 'Error',
        description: `Failed to upload photo: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  React.useEffect(() => {
    fetchStudents();
  }, []);

  return (
    <div className="space-y-6">
      <Card className="bg-white rounded-3xl shadow-lg border border-border/20">
        <CardHeader className="border-b border-border/10">
          <CardTitle className="flex items-center gap-2 text-2xl font-bold">
            <ImageIcon className="w-6 h-6 text-primary" />
            Student Photo Management
          </CardTitle>
          <p className="text-muted-foreground">
            Upload and manage individual student photos. Use the search to quickly find specific students.
          </p>
        </CardHeader>
        <CardContent className="p-6">
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Input
                type="text"
                placeholder="Search by name or serial number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 text-base border-2 border-border/20 rounded-xl focus:border-primary transition-colors"
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                <Search className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
            {searchTerm && (
              <p className="mt-2 text-sm text-muted-foreground">
                Found {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Students Grid */}
          <div className="grid gap-4">
            {filteredStudents.map((student) => (
              <div key={student.id} className="group">
                <Card className="overflow-hidden border border-border/20 hover:border-primary/30 transition-all duration-200 hover:shadow-md bg-gradient-to-r from-background to-accent/5">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="relative w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-border/10">
                          {student.photo_url ? (
                            <>
                              <img
                                src={`${student.photo_url}${student.photo_url.includes('?') ? '&' : '?'}cb=${student.updated_at ? new Date(student.updated_at).getTime() : ''}`}
                                data-src={student.photo_url}
                                alt={student.name}
                                loading="lazy"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.currentTarget as HTMLImageElement;
                                  const original = target.getAttribute('data-src') || target.src;
                                  const retried = target.getAttribute('data-retried') === 'true';
                                  if (!retried) {
                                    target.setAttribute('data-retried', 'true');
                                    target.src = `${original}${original.includes('?') ? '&' : '?'}cb=${Date.now()}`;
                                    return;
                                  }
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
                              <div className="fallback-icon hidden w-full h-full items-center justify-center flex-col bg-red-50 border-2 border-red-200 rounded-2xl">
                                <ImageIcon className="w-6 h-6 text-red-400" />
                                <div className="no-image-text text-xs text-red-500 mt-1">Failed</div>
                              </div>
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center flex-col">
                              <ImageIcon className="w-6 h-6 text-muted-foreground" />
                              <div className="text-xs text-muted-foreground mt-1">No Photo</div>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <h3 className="font-bold text-lg text-foreground">{student.name}</h3>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs font-medium px-2 py-1">
                              Serial: {student.serial_number}
                            </Badge>
                            {student.photo_url && (
                              <Badge 
                                variant={student.photo_url.includes('drive.google.com') ? 'destructive' : 'default'} 
                                className="text-xs font-medium px-2 py-1"
                              >
                                {student.photo_url.includes('drive.google.com') ? 'Google Drive' : 'Supabase'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <div className="relative">
                          <Input
                            type="file"
                            accept="image/*,.heic,.HEIC"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(file, student.id, student.serial_number);
                              }
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            id={`file-${student.id}`}
                          />
                          <label 
                            htmlFor={`file-${student.id}`}
                            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg h-11 px-6 py-2 cursor-pointer group-hover:scale-105 transform"
                          >
                            <Upload className="w-4 h-4" />
                            Choose Photo
                          </label>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
            
            {filteredStudents.length === 0 && (
              <div className="text-center py-12">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-xl font-semibold text-muted-foreground mb-2">
                  {searchTerm ? 'No students found' : 'No students available'}
                </h3>
                <p className="text-muted-foreground">
                  {searchTerm ? 'Try adjusting your search terms' : 'Students will appear here when available'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PhotoUploadManager;