import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState } from "react";

export const GCashGuideCard = () => {
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);

  return (
    <Card className="w-full animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-500 animate-pulse" />
          🇵🇭 GCash Quick Guides
          <Badge variant="outline" className="text-xs animate-fade-in">Philippines</Badge>
        </CardTitle>
        <CardDescription>
          Learn how to deposit and withdraw using GCash GCrypto in the Philippines
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Deposit Card */}
          <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
            <DialogTrigger asChild>
              <Card className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border-2 hover:border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 focus-within:ring-2 focus-within:ring-green-400 focus-within:ring-offset-2">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-2 p-3 bg-green-100 dark:bg-green-900/30 rounded-full w-16 h-16 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                    <ArrowDownToLine className="h-8 w-8 text-green-600 dark:text-green-400 transition-transform duration-300 group-hover:translate-y-1" />
                  </div>
                  <CardTitle className="text-xl transition-colors duration-200 group-hover:text-green-600 dark:group-hover:text-green-400">
                    💸 How to Deposit
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Fund your account using GCash GCrypto
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <Badge variant="secondary" className="bg-green-600 hover:bg-green-700 text-white transition-all duration-200 group-hover:shadow-md">
                    Click to View Guide
                  </Badge>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="max-w-2xl animate-scale-in">
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2 text-2xl animate-fade-in">
                  💸 How to Deposit & Upgrade Using GCash
                  <Badge variant="default" className="bg-green-600 hover:bg-green-600 animate-fade-in">
                    🇵🇭 Philippines
                  </Badge>
                </DialogTitle>
                <DialogDescription className="animate-fade-in">
                  Follow these simple steps to deposit USDC using GCash GCrypto
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 scroll-smooth">
                {/* Step 1 */}
                <div className="flex gap-3 animate-fade-in hover:bg-green-50/50 dark:hover:bg-green-950/10 p-2 rounded-lg transition-colors duration-200">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-bold flex items-center justify-center shadow-sm">
                    1
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm leading-relaxed">
                      Open your <strong className="text-green-700 dark:text-green-300">GCash App</strong> → Tap <strong className="text-green-700 dark:text-green-300">GCrypto</strong> (under "View All" → "Finance").
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3 animate-fade-in hover:bg-green-50/50 dark:hover:bg-green-950/10 p-2 rounded-lg transition-colors duration-200" style={{ animationDelay: '0.1s' }}>
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-bold flex items-center justify-center shadow-sm">
                    2
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm leading-relaxed">
                      Tap <strong className="text-green-700 dark:text-green-300">Buy Crypto</strong> → Choose <strong className="text-green-700 dark:text-green-300">USDC (Solana)</strong>{" "}
                      <span className="text-green-600 dark:text-green-400 font-semibold bg-green-100/50 dark:bg-green-900/20 px-1.5 py-0.5 rounded">
                        (recommended for lowest fees)
                      </span>{" "}
                      or any other supported coin → Complete your purchase on GCrypto.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3 animate-fade-in hover:bg-green-50/50 dark:hover:bg-green-950/10 p-2 rounded-lg transition-colors duration-200" style={{ animationDelay: '0.2s' }}>
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-bold flex items-center justify-center shadow-sm">
                    3
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm leading-relaxed">
                      Go to your <strong className="text-green-700 dark:text-green-300">FineEarn account</strong>, open the <strong className="text-green-700 dark:text-green-300">Deposit page</strong> → Enter your deposit amount.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-3 animate-fade-in hover:bg-green-50/50 dark:hover:bg-green-950/10 p-2 rounded-lg transition-colors duration-200" style={{ animationDelay: '0.3s' }}>
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-bold flex items-center justify-center shadow-sm">
                    4
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm leading-relaxed">
                      Choose <strong className="text-green-700 dark:text-green-300">USDC</strong> as the coin → Select <strong className="text-green-700 dark:text-green-300">Solana</strong> as the network → Copy the wallet address shown on FineEarn.
                    </p>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="flex gap-3 animate-fade-in hover:bg-green-50/50 dark:hover:bg-green-950/10 p-2 rounded-lg transition-colors duration-200" style={{ animationDelay: '0.4s' }}>
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-bold flex items-center justify-center shadow-sm">
                    5
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm leading-relaxed">
                      Go back to <strong className="text-green-700 dark:text-green-300">GCrypto</strong> → Tap <strong className="text-green-700 dark:text-green-300">Send Crypto</strong> → Paste the FineEarn wallet address you copied.
                    </p>
                  </div>
                </div>

                {/* Step 6 */}
                <div className="flex gap-3 animate-fade-in hover:bg-green-50/50 dark:hover:bg-green-950/10 p-2 rounded-lg transition-colors duration-200" style={{ animationDelay: '0.5s' }}>
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-bold flex items-center justify-center shadow-sm">
                    6
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm leading-relaxed">
                      Enter the same amount and confirm the transaction.
                    </p>
                  </div>
                </div>

                {/* Success Message */}
                <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 animate-fade-in shadow-sm" style={{ animationDelay: '0.6s' }}>
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 animate-pulse" />
                  <AlertDescription className="text-green-800 dark:text-green-200 font-semibold text-sm">
                    ✅ Once payment is confirmed on the blockchain, your FineEarn deposit wallet will be credited automatically.
                  </AlertDescription>
                </Alert>
              </div>
            </DialogContent>
          </Dialog>

          {/* Withdraw Card */}
          <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
            <DialogTrigger asChild>
              <Card className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border-2 hover:border-blue-400 bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/20 dark:to-sky-950/20 focus-within:ring-2 focus-within:ring-blue-400 focus-within:ring-offset-2">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-2 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full w-16 h-16 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                    <ArrowUpFromLine className="h-8 w-8 text-blue-600 dark:text-blue-400 transition-transform duration-300 group-hover:-translate-y-1" />
                  </div>
                  <CardTitle className="text-xl transition-colors duration-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    💰 How to Withdraw
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Cash out earnings to your GCash wallet
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <Badge variant="secondary" className="bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 group-hover:shadow-md">
                    Click to View Guide
                  </Badge>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="max-w-2xl animate-scale-in">
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2 text-2xl animate-fade-in">
                  💰 How to Withdraw to GCash
                  <Badge variant="default" className="bg-blue-600 hover:bg-blue-600 animate-fade-in">
                    🇵🇭 Philippines
                  </Badge>
                </DialogTitle>
                <DialogDescription className="animate-fade-in">
                  Follow these simple steps to withdraw your earnings to GCash
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 scroll-smooth">
                {/* Step 1 */}
                <div className="flex gap-3 animate-fade-in hover:bg-blue-50/50 dark:hover:bg-blue-950/10 p-2 rounded-lg transition-colors duration-200">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shadow-sm">
                    1
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm leading-relaxed">
                      In your <strong className="text-blue-700 dark:text-blue-300">GCash App</strong>, go to <strong className="text-blue-700 dark:text-blue-300">GCrypto</strong> → Select <strong className="text-blue-700 dark:text-blue-300">USDC (Solana)</strong> → Tap <strong className="text-blue-700 dark:text-blue-300">Receive</strong> → Copy your <strong className="text-blue-700 dark:text-blue-300">USDC (Solana)</strong> wallet address.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3 animate-fade-in hover:bg-blue-50/50 dark:hover:bg-blue-950/10 p-2 rounded-lg transition-colors duration-200" style={{ animationDelay: '0.1s' }}>
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shadow-sm">
                    2
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm leading-relaxed">
                      On <strong className="text-blue-700 dark:text-blue-300">FineEarn</strong>, open the <strong className="text-blue-700 dark:text-blue-300">Withdraw page</strong> → Enter your withdrawal amount.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3 animate-fade-in hover:bg-blue-50/50 dark:hover:bg-blue-950/10 p-2 rounded-lg transition-colors duration-200" style={{ animationDelay: '0.2s' }}>
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shadow-sm">
                    3
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm leading-relaxed">
                      Paste the <strong className="text-blue-700 dark:text-blue-300">GCrypto USDC (Solana)</strong> address you copied earlier → Confirm and submit your withdrawal request.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-3 animate-fade-in hover:bg-blue-50/50 dark:hover:bg-blue-950/10 p-2 rounded-lg transition-colors duration-200" style={{ animationDelay: '0.3s' }}>
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shadow-sm">
                    4
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm leading-relaxed">
                      Once processed, you'll receive <strong className="text-blue-700 dark:text-blue-300">USDC</strong> in your <strong className="text-blue-700 dark:text-blue-300">GCrypto wallet</strong>.
                    </p>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="flex gap-3 animate-fade-in hover:bg-blue-50/50 dark:hover:bg-blue-950/10 p-2 rounded-lg transition-colors duration-200" style={{ animationDelay: '0.4s' }}>
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shadow-sm">
                    5
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm leading-relaxed">
                      To convert to PHP, go to <strong className="text-blue-700 dark:text-blue-300">GCrypto</strong> → Tap <strong className="text-blue-700 dark:text-blue-300">Sell USDC</strong> → Choose <strong className="text-blue-700 dark:text-blue-300">GCash Balance</strong>.
                    </p>
                  </div>
                </div>

                {/* Success Message */}
                <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 animate-fade-in shadow-sm" style={{ animationDelay: '0.5s' }}>
                  <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-pulse" />
                  <AlertDescription className="text-blue-800 dark:text-blue-200 font-semibold text-sm">
                    💵 Your funds will reflect instantly in your GCash wallet.
                  </AlertDescription>
                </Alert>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
};
