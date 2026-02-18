import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, Crown, AlertCircle, Loader2 } from "lucide-react";

interface ManageRolesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  username: string;
  currentRoles: string[];
  onSuccess: () => void;
}

type AppRole = 'user' | 'admin' | 'moderator' | 'trainee_4opt';

export function ManageRolesDialog({
  open,
  onOpenChange,
  userId,
  username,
  currentRoles: initialRoles,
  onSuccess,
}: ManageRolesDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentRoles, setCurrentRoles] = useState<string[]>(initialRoles);
  const [selectedRoles, setSelectedRoles] = useState<Set<AppRole>>(new Set(initialRoles as AppRole[]));
  const [error, setError] = useState<string | null>(null);

  // Fetch current roles when dialog opens
  useEffect(() => {
    if (open) {
      fetchCurrentRoles();
    }
  }, [open, userId]);

  const fetchCurrentRoles = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('admin-manage-user', {
        body: { 
          action: 'get_user_roles',
          userId 
        }
      });

      if (fetchError) throw fetchError;

      const roles = data?.roles || ['user'];
      setCurrentRoles(roles);
      setSelectedRoles(new Set(roles as AppRole[]));
    } catch (err: any) {
      console.error('Error fetching user roles:', err);
      setError(err.message || 'Failed to fetch user roles');
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch user roles. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleToggle = (role: AppRole) => {
    if (role === 'user') return;

    setSelectedRoles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(role)) {
        newSet.delete(role);
      } else {
        newSet.add(role);
      }
      return newSet;
    });
  };

  const calculateChanges = () => {
    const current = new Set(currentRoles);
    const selected = selectedRoles;

    const toAdd: AppRole[] = [];
    const toRemove: AppRole[] = [];

    // Find roles to add
    selected.forEach(role => {
      if (!current.has(role)) {
        toAdd.push(role);
      }
    });

    // Find roles to remove
    current.forEach(role => {
      if (!selected.has(role as AppRole) && role !== 'user') {
        toRemove.push(role as AppRole);
      }
    });

    return { toAdd, toRemove };
  };

  const handleSave = async () => {
    const { toAdd, toRemove } = calculateChanges();

    // No changes
    if (toAdd.length === 0 && toRemove.length === 0) {
      toast({
        title: "No Changes",
        description: "No role changes to apply.",
      });
      onOpenChange(false);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Add new roles
      for (const role of toAdd) {
        const { error: assignError } = await supabase.functions.invoke('admin-manage-user', {
          body: {
            action: 'assign_role',
            userId,
            roleData: { role }
          }
        });

        if (assignError) throw new Error(`Failed to assign ${role} role: ${assignError.message}`);
      }

      // Remove roles
      for (const role of toRemove) {
        const { error: removeError } = await supabase.functions.invoke('admin-manage-user', {
          body: {
            action: 'remove_role',
            userId,
            roleData: { role }
          }
        });

        if (removeError) throw new Error(`Failed to remove ${role} role: ${removeError.message}`);
      }

      toast({
        title: "Success",
        description: "Roles updated successfully",
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error updating roles:', err);
      setError(err.message || 'Failed to update roles');
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to update roles. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const { toAdd, toRemove } = calculateChanges();
  const hasChanges = toAdd.length > 0 || toRemove.length > 0;
  const isAddingAdmin = toAdd.includes('admin');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Manage Roles - {username}
          </DialogTitle>
          <DialogDescription>
            Assign or revoke user roles. Changes will take effect immediately.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Current Roles Display */}
            <div>
              <Label className="text-sm text-muted-foreground">Current Roles</Label>
              <div className="flex gap-2 mt-2">
                {currentRoles.map(role => (
                  <Badge 
                    key={role} 
                    variant={role === 'admin' ? 'default' : 'outline'}
                    className="flex items-center gap-1"
                  >
                    {role === 'admin' && <Crown className="h-3 w-3" />}
                    {role}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-3 border rounded-lg p-4">
              <Label>Select Roles</Label>
              
              {/* User Role (always checked, disabled) */}
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="role-user"
                  checked={true}
                  disabled={true}
                />
                <Label 
                  htmlFor="role-user"
                  className="text-sm font-normal cursor-not-allowed opacity-70"
                >
                  User (Base role - cannot be removed)
                </Label>
              </div>

              {/* Admin Role */}
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="role-admin"
                  checked={selectedRoles.has('admin')}
                  onCheckedChange={() => handleRoleToggle('admin')}
                  disabled={saving}
                />
                <Label 
                  htmlFor="role-admin"
                  className="text-sm font-normal cursor-pointer flex items-center gap-2"
                >
                  <Crown className="h-4 w-4 text-yellow-500" />
                  Admin (Full platform access)
                </Label>
              </div>

              {/* Moderator Role */}
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="role-moderator"
                  checked={selectedRoles.has('moderator')}
                  onCheckedChange={() => handleRoleToggle('moderator')}
                  disabled={saving}
                />
                <Label 
                  htmlFor="role-moderator"
                  className="text-sm font-normal cursor-pointer"
                >
                  Moderator (Limited admin access - future use)
                </Label>
              </div>

              {/* 4-Option Tasks Access */}
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="role-trainee_4opt"
                  checked={selectedRoles.has('trainee_4opt')}
                  onCheckedChange={() => handleRoleToggle('trainee_4opt')}
                  disabled={saving}
                />
                <Label 
                  htmlFor="role-trainee_4opt"
                  className="text-sm font-normal cursor-pointer"
                >
                  4-Option Tasks (User sees 4-option AI tasks instead of 2-option)
                </Label>
              </div>
            </div>

            {/* Warning when adding admin role */}
            {isAddingAdmin && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Warning: Granting Admin Access</AlertTitle>
                <AlertDescription>
                  This will grant full administrative access to the platform. This user will be able to:
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>Manage all users and finances</li>
                    <li>Process withdrawals</li>
                    <li>Access sensitive data</li>
                    <li>Modify system settings</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Changes Summary */}
            {hasChanges && (
              <div className="bg-muted p-3 rounded-lg text-sm">
                <strong>Changes to apply:</strong>
                <div className="mt-1 space-y-1">
                  {toAdd.length > 0 && (
                    <div className="text-green-600 dark:text-green-400">
                      Adding: {toAdd.join(', ')}
                    </div>
                  )}
                  {toRemove.length > 0 && (
                    <div className="text-red-600 dark:text-red-400">
                      Removing: {toRemove.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={loading || saving || !hasChanges}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Update Roles
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
