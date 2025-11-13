import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SubItem {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  is_active: boolean;
}

interface SubItemCarouselProps {
  subItems: SubItem[];
}

export const SubItemCarousel = ({ subItems }: SubItemCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-switch to active sub-item when it changes
  useEffect(() => {
    const activeIndex = subItems.findIndex(item => item.is_active);
    if (activeIndex !== -1) {
      setCurrentIndex(activeIndex);
    }
  }, [subItems]);

  if (!subItems || subItems.length === 0) {
    return null;
  }

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? subItems.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === subItems.length - 1 ? 0 : prev + 1));
  };

  const currentItem = subItems[currentIndex];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Navigation Controls */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="lg"
          onClick={handlePrevious}
          className="rounded-full h-12 w-12 p-0"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            {currentIndex + 1} / {subItems.length}
          </span>
          {currentItem?.is_active && (
            <Badge variant="default" className="animate-pulse">
              Active
            </Badge>
          )}
        </div>

        <Button
          variant="outline"
          size="lg"
          onClick={handleNext}
          className="rounded-full h-12 w-12 p-0"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      {/* Current Sub-Item Card */}
      <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-2">
        <CardContent className="p-8 space-y-4">
          <h2 className="text-3xl font-bold text-center">
            {currentItem?.title}
          </h2>

          {currentItem?.description && (
            <p className="text-lg text-center text-muted-foreground">
              {currentItem.description}
            </p>
          )}

          {currentItem?.content && (
            <div className="mt-6 p-4 bg-background/50 rounded-lg border">
              <p className="text-base whitespace-pre-wrap">
                {currentItem.content}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dot Indicators */}
      <div className="flex items-center justify-center gap-2">
        {subItems.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`h-2 rounded-full transition-all ${
              index === currentIndex 
                ? 'w-8 bg-primary' 
                : 'w-2 bg-primary/30 hover:bg-primary/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
