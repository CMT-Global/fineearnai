import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Copy, Check, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ALL_AVAILABLE_VARIABLES, MOST_USED_VARIABLES, getCategoryIcon } from "@/lib/email-variables";

interface EmailVariableReferenceProps {
  onInsert?: (variableName: string) => void;
}

export const EmailVariableReference = ({ onInsert }: EmailVariableReferenceProps) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);

  // Filter variables based on search query
  const filteredCategories = Object.entries(ALL_AVAILABLE_VARIABLES).reduce((acc, [category, variables]) => {
    const filtered = variables.filter(
      (v) =>
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (filtered.length > 0) {
      acc[category] = filtered;
    }
    return acc;
  }, {} as Record<string, typeof MOST_USED_VARIABLES>);

  const handleCopy = (variableName: string) => {
    const variableText = `{{${variableName}}}`;
    navigator.clipboard.writeText(variableText);
    setCopiedVariable(variableName);
    toast.success(t("admin.emailTemplates.toasts.copiedToClipboard", { variable: variableText }));
    setTimeout(() => setCopiedVariable(null), 2000);
  };

  const handleInsert = (variableName: string) => {
    if (onInsert) {
      onInsert(variableName);
      toast.success(t("admin.emailTemplates.toasts.addedToEditor", { variable: `{{${variableName}}}` }));
    } else {
      handleCopy(variableName);
    }
  };

  const renderVariableItem = (variable: typeof MOST_USED_VARIABLES[0]) => {
    const isCopied = copiedVariable === variable.name;
    
    return (
      <div
        key={variable.name}
        className="group flex items-start justify-between gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
            {`{{${variable.name}}}`}
          </code>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {variable.description}
          </p>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => handleCopy(variable.name)}
            title="Copy to clipboard"
          >
            {isCopied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          📝 Available Variables
        </CardTitle>
        <CardDescription className="text-xs">
          Click to copy variables for personalization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search variables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        {/* Most Used Section */}
        {!searchQuery && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              <h4 className="text-sm font-semibold">Most Used</h4>
            </div>
            <div className="space-y-1">
              {MOST_USED_VARIABLES.map(renderVariableItem)}
            </div>
          </div>
        )}

        {/* Categories */}
        <Accordion type="multiple" className="w-full space-y-2">
          {Object.entries(filteredCategories).map(([category, variables]) => (
            <AccordionItem
              key={category}
              value={category}
              className="border rounded-lg px-3"
            >
              <AccordionTrigger className="py-3 text-sm hover:no-underline">
                <div className="flex items-center gap-2">
                  <span>{getCategoryIcon(category)}</span>
                  <span className="font-medium">{category}</span>
                  <Badge variant="secondary" className="ml-auto mr-2 text-xs">
                    {variables.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3 pt-1">
                <div className="space-y-1">
                  {variables.map(renderVariableItem)}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {/* No Results */}
        {searchQuery && Object.keys(filteredCategories).length === 0 && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No variables found matching "{searchQuery}"
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <p>💡 <strong>Tip:</strong> Variables are replaced with actual user data when emails are sent.</p>
          <p>⚠️ Not all variables are available in every email type.</p>
        </div>
      </CardContent>
    </Card>
  );
};
