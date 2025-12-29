import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  AlertTriangle,
  User,
  Mail,
  Shield,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface ChangeUplineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  currentUpline?: {
    id: string;
    username: string;
    email: string;
    membership_plan: string;
  } | null;
  onSuccess: () => void;
}

interface ValidatedUser {
  id: string;
  username: string;
  email: string;
  membership_plan: string;
  account_status: string;
}

type ValidationState = 
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'valid'; user: ValidatedUser }
  | { status: 'invalid'; message: string }
  | { status: 'error'; message: string };

export function ChangeUplineDialog({
  open,
  onOpenChange,
  userId,
  currentUpline,
  onSuccess,
}: ChangeUplineDialogProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [validationState, setValidationState] = useState<ValidationState>({ status: 'idle' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const debouncedInput = useDebounce(input, 500);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setInput("");
      setValidationState({ status: 'idle' });
      setIsSubmitting(false);
    }
  }, [open]);

  // Real-time validation
  useEffect(() => {
    if (!debouncedInput.trim()) {
      setValidationState({ status: 'idle' });
      return;
    }

    const validateUpline = async () => {
      setValidationState({ status: 'checking' });

      try {
        // Determine if input is email or username
        const isEmail = debouncedInput.includes('@');
        
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, email, membership_plan, account_status')
          .or(isEmail 
            ? `email.ilike.${debouncedInput}` 
            : `username.ilike.${debouncedInput}`
          )
          .maybeSingle();

        if (error) {
          setValidationState({ 
            status: 'error', 
            message: 'Failed to validate user. Please try again.' 
          });
          return;
        }

        if (!data) {
          setValidationState({ 
            status: 'invalid', 
            message: 'User not found. Please check the email or username.' 
          });
          return;
        }

        // Check if trying to set user as their own upline
        if (data.id === userId) {
          setValidationState({ 
            status: 'invalid', 
            message: 'You cannot select the same user as their own upline.' 
          });
          return;
        }

        // Check if user account is active
        if (data.account_status !== 'active') {
          setValidationState({ 
            status: 'invalid', 
            message: `This user account is ${data.account_status}. Only active users can be set as uplines.` 
          });
          return;
        }

        // Valid user found
        setValidationState({ 
          status: 'valid', 
          user: data as ValidatedUser
        });

      } catch (err) {
        console.error('Validation error:', err);
        setValidationState({ 
          status: 'error', 
          message: 'An unexpected error occurred during validation.' 
        });
      }
    };

    validateUpline();
  }, [debouncedInput, userId]);

  const handleSubmit = async () => {
    if (validationState.status !== 'valid') return;

    const newUplineEmail = validationState.user.email;
    
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: { 
          action: 'change_upline', 
          userId, 
          newUplineEmail 
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.message || 'Failed to change upline');
      }

      toast.success('Upline changed successfully. Future commissions will go to the new upline.');
      onSuccess();
      onOpenChange(false);

    } catch (err: any) {
      console.error('Error changing upline:', err);
      toast.error(err.message || 'Failed to change upline. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isConfirmDisabled = validationState.status !== 'valid' || isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Change Upline</DialogTitle>
          <DialogDescription>
            Change the upline for this user. All future referral commissions will be redirected to the new upline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Upline Info */}
          {currentUpline ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <div className="font-medium mb-1">Current Upline:</div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>{currentUpline.username}</span>
                  <span className="text-xs">({currentUpline.email})</span>
                  <Badge variant="outline" className="text-xs">
                    {currentUpline.membership_plan}
                  </Badge>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <div className="font-medium mb-1">No Current Upline</div>
                <div className="text-muted-foreground">
                  This user doesn't have an upline yet. Setting one will enable referral commissions.
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Input Field */}
          <div className="space-y-2">
            <Label htmlFor="upline-input">
              New Upline Email or Username
            </Label>
            <Input
              id="upline-input"
              placeholder="Enter email or username..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isSubmitting}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Type the email address or username of the user you want to set as the new upline.
            </p>
          </div>

          {/* Validation Feedback */}
          {validationState.status === 'checking' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Checking user...</span>
            </div>
          )}

          {validationState.status === 'invalid' && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {validationState.message}
              </AlertDescription>
            </Alert>
          )}

          {validationState.status === 'error' && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {validationState.message}
              </AlertDescription>
            </Alert>
          )}

          {validationState.status === 'valid' && (
            <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="font-medium text-sm text-green-900 dark:text-green-100">
                      Valid user found
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-green-700 dark:text-green-300" />
                        <span className="font-medium text-green-900 dark:text-green-100">
                          {validationState.user.username}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-green-700 dark:text-green-300" />
                        <span className="text-green-800 dark:text-green-200">
                          {validationState.user.email}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield className="h-3.5 w-3.5 text-green-700 dark:text-green-300" />
                        <Badge 
                          variant="outline" 
                          className="text-xs border-green-300 dark:border-green-700"
                        >
                          {validationState.user.membership_plan}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className="text-xs border-green-300 dark:border-green-700"
                        >
                          {validationState.user.account_status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isConfirmDisabled}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Confirm Change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
