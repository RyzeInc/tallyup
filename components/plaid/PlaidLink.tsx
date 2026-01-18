"use client";

/**
 * PlaidLink Component
 * 
 * Provides the Plaid Link integration for connecting bank accounts.
 * Uses react-plaid-link to handle the Plaid Link flow.
 */

import { useCallback, useState, useEffect } from "react";
import { usePlaidLink, PlaidLinkOnSuccess, PlaidLinkOnExit, PlaidLinkOptions } from "react-plaid-link";
import { useAction } from "convex/react";
import { api } from "convex/_generated/api";
import * as Lucide from "lucide-react";
import { useToast } from "@/components/ToastProvider";

interface PlaidLinkButtonProps {
  onSuccess?: (result: { institutionName: string; accountCount: number; plaidItemId: string }) => void;
  onExit?: () => void;
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  children?: React.ReactNode;
}

export function PlaidLinkButton({
  onSuccess,
  onExit,
  className = "",
  variant = "default",
  size = "default",
  children,
}: PlaidLinkButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  
  const toast = useToast();
  const createLinkToken = useAction(api.plaidActions.createLinkToken);
  const exchangePublicToken = useAction(api.plaidActions.exchangePublicToken);
  
  // Initialize Plaid Link
  const initializeLink = useCallback(async () => {
    setIsLoading(true);
    
    try {
      console.log("[PlaidLink] Creating link token...");
      // Only request 'transactions' as the primary product - this supports checking, savings, and credit accounts
      // Investments and liabilities data can be fetched separately for accounts that support them
      // Requesting multiple products together restricts Link to only show accounts supporting ALL products
      const result = await createLinkToken({ products: ["transactions"] });
      console.log("[PlaidLink] Link token created:", result.linkToken ? "SUCCESS" : "FAILED");
      setLinkToken(result.linkToken);
    } catch (err) {
      console.error("[PlaidLink] Error creating link token:", err);
      toast.error("Failed to connect to Plaid. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [createLinkToken, toast]);
  
  // Handle successful link
  const handleSuccess: PlaidLinkOnSuccess = useCallback(
    async (publicToken, metadata) => {
      setIsLoading(true);
      
      try {
        const result = await exchangePublicToken({
          publicToken,
          institutionId: metadata.institution?.institution_id,
          institutionName: metadata.institution?.name,
        });
        
        toast.success(
          `Successfully linked ${result.institutionName || "institution"} with ${result.accountCount} account(s). Syncing data...`
        );
        
        onSuccess?.({
          institutionName: result.institutionName || "Unknown",
          accountCount: result.accountCount,
          plaidItemId: result.plaidItemId,
        });
      } catch (err) {
        console.error("Error exchanging token:", err);
        toast.error("Failed to link accounts. Please try again.");
      } finally {
        setIsLoading(false);
        setLinkToken(null);
      }
    },
    [exchangePublicToken, toast, onSuccess]
  );
  
  // Handle exit
  const handleExit: PlaidLinkOnExit = useCallback(
    (err) => {
      // Note: err can be an empty object {} when user just closes the modal normally
      // Only log actual errors (objects with properties)
      if (err && Object.keys(err).length > 0) {
        console.error("Plaid Link error:", err);
      }
      setLinkToken(null);
      onExit?.();
    },
    [onExit]
  );
  
  // Configure Plaid Link - usePlaidLink requires token to be null (not conditional object)
  const config: PlaidLinkOptions = {
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: handleExit,
  };
  
  const { open, ready } = usePlaidLink(config);
  
  // Debug logging
  useEffect(() => {
    console.log("[PlaidLink] State:", { linkToken: !!linkToken, ready, isLoading });
  }, [linkToken, ready, isLoading]);
  
  // Auto-open Plaid Link when token is ready
  useEffect(() => {
    if (linkToken && ready) {
      console.log("[PlaidLink] Opening Plaid Link modal...");
      try {
        open();
        console.log("[PlaidLink] Modal opened successfully");
      } catch (err) {
        console.error("[PlaidLink] Error opening modal:", err);
      }
    }
  }, [linkToken, ready, open]);
  
  // Handle button click
  const handleClick = async () => {
    if (linkToken && ready) {
      open();
    } else {
      await initializeLink();
    }
  };
  
  // Button styles
  const baseStyles = "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantStyles = {
    default: "bg-[#2F6F85] text-white hover:bg-[#245a6d] focus:ring-[#2F6F85]",
    outline: "border-2 border-[#2F6F85] text-[#2F6F85] hover:bg-[#2F6F85]/10 focus:ring-[#2F6F85]",
    ghost: "text-[#2F6F85] hover:bg-[#2F6F85]/10 focus:ring-[#2F6F85]",
  };
  
  const sizeStyles = {
    default: "px-4 py-2 text-sm",
    sm: "px-3 py-1.5 text-xs",
    lg: "px-6 py-3 text-base",
  };
  
  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {isLoading ? (
        <>
          <Lucide.Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : (
        children || (
          <>
            <Lucide.Link2 className="mr-2 h-4 w-4" />
            Connect Bank Account
          </>
        )
      )}
    </button>
  );
}

/**
 * Plaid Link Card Component
 * 
 * A card-style component for initiating Plaid Link.
 */
interface PlaidLinkCardProps {
  onSuccess?: (result: { institutionName: string; accountCount: number; plaidItemId: string }) => void;
  onExit?: () => void;
}

export function PlaidLinkCard({ onSuccess, onExit }: PlaidLinkCardProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 bg-white dark:bg-gray-800 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-[#2F6F85]/10 flex items-center justify-center">
            <Lucide.Building2 className="h-6 w-6 text-[#2F6F85]" />
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Link Your Bank Account
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Securely connect your bank accounts to automatically import transactions
            and keep your balances up to date.
          </p>
          <div className="mt-4">
            <PlaidLinkButton onSuccess={onSuccess} onExit={onExit} />
          </div>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <span>Bank-level security with 256-bit encryption</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Plaid Reauth Component
 * 
 * For reconnecting an institution that needs reauthentication.
 */
interface PlaidReauthProps {
  plaidItemId: string;
  institutionName?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PlaidReauthButton({ plaidItemId, institutionName, onSuccess, onCancel }: PlaidReauthProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  
  const toast = useToast();
  const createUpdateLinkToken = useAction(api.plaidActions.createUpdateLinkToken);
  
  // Initialize update mode link
  const initializeLink = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const result = await createUpdateLinkToken({
        plaidItemId: plaidItemId as never,
      });
      setLinkToken(result.linkToken);
    } catch (err) {
      console.error("Error creating update link token:", err);
      toast.error("Failed to initialize reconnection. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [createUpdateLinkToken, plaidItemId, toast]);
  
  // Handle successful reauth
  const handleSuccess: PlaidLinkOnSuccess = useCallback(() => {
    toast.success(`Successfully reconnected ${institutionName || "institution"}`);
    setLinkToken(null);
    onSuccess?.();
  }, [institutionName, toast, onSuccess]);
  
  // Handle exit
  const handleExit: PlaidLinkOnExit = useCallback(() => {
    setLinkToken(null);
    onCancel?.();
  }, [onCancel]);
  
  // Configure Plaid Link
  const config: PlaidLinkOptions = {
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: handleExit,
  };
  
  const { open, ready } = usePlaidLink(config);
  
  // Auto-open Plaid Link when token is ready
  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);
  
  // Handle button click
  const handleClick = async () => {
    if (linkToken && ready) {
      open();
    } else {
      await initializeLink();
    }
  };
  
  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 transition-colors"
    >
      {isLoading ? (
        <Lucide.Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <Lucide.AlertCircle className="mr-1.5 h-4 w-4" />
          Reconnect
        </>
      )}
    </button>
  );
}

export default PlaidLinkButton;
