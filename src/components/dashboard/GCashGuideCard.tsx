import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const GCashGuideCard = () => {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🇵🇭 GCash Quick Guides
          <Badge variant="outline" className="text-xs">Philippines</Badge>
        </CardTitle>
        <CardDescription>
          Learn how to deposit and withdraw using GCash GCrypto in the Philippines
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Deposit Card */}
          <Dialog>
            <DialogTrigger asChild>
              <Card className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-105 border-2 hover:border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-2 p-3 bg-green-100 dark:bg-green-900/30 rounded-full w-16 h-16 flex items-center justify-center">
                    <ArrowDownToLine className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <CardTitle className="text-xl">💸 How to Deposit</CardTitle>
                  <CardDescription className="text-sm">
                    Fund your account using GCash GCrypto
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <Badge variant="secondary" className="bg-green-600 hover:bg-green-700 text-white">
                    Click to View Guide
                  </Badge>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-2xl">
                  💸 How to Deposit & Upgrade Using GCash
                  <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                    🇵🇭 Philippines
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Follow these simple steps to deposit USDC using GCash GCrypto
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {/* Step 1 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-bold flex items-center justify-center">
                    1
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm">
                      Open your <strong>GCash App</strong> → Tap <strong>GCrypto</strong> (under "View All" → "Finance").
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-bold flex items-center justify-center">
                    2
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm">
                      Tap <strong>Buy Crypto</strong> → Choose <strong>USDC (Solana)</strong>{" "}
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        (recommended for lowest fees)
                      </span>{" "}
                      or any other supported coin → Complete your purchase on GCrypto.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-bold flex items-center justify-center">
                    3
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm">
                      Go to your <strong>FineEarn account</strong>, open the <strong>Deposit page</strong> → Enter your deposit amount.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-bold flex items-center justify-center">
                    4
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm">
                      Choose <strong>USDC</strong> as the coin → Select <strong>Solana</strong> as the network → Copy the wallet address shown on FineEarn.
                    </p>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-bold flex items-center justify-center">
                    5
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm">
                      Go back to <strong>GCrypto</strong> → Tap <strong>Send Crypto</strong> → Paste the FineEarn wallet address you copied.
                    </p>
                  </div>
                </div>

                {/* Step 6 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-bold flex items-center justify-center">
                    6
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm">
                      Enter the same amount and confirm the transaction.
                    </p>
                  </div>
                </div>

                {/* Success Message */}
                <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertDescription className="text-green-800 dark:text-green-200 font-medium text-sm">
                    ✅ Once payment is confirmed on the blockchain, your FineEarn deposit wallet will be credited automatically.
                  </AlertDescription>
                </Alert>
              </div>
            </DialogContent>
          </Dialog>

          {/* Withdraw Card */}
          <Dialog>
            <DialogTrigger asChild>
              <Card className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-105 border-2 hover:border-blue-400 bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/20 dark:to-sky-950/20">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-2 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full w-16 h-16 flex items-center justify-center">
                    <ArrowUpFromLine className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-xl">💰 How to Withdraw</CardTitle>
                  <CardDescription className="text-sm">
                    Cash out earnings to your GCash wallet
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <Badge variant="secondary" className="bg-blue-600 hover:bg-blue-700 text-white">
                    Click to View Guide
                  </Badge>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-2xl">
                  💰 How to Withdraw to GCash
                  <Badge variant="default" className="bg-blue-600 hover:bg-blue-600">
                    🇵🇭 Philippines
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Follow these simple steps to withdraw your earnings to GCash
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {/* Step 1 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center">
                    1
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm">
                      In your <strong>GCash App</strong>, go to <strong>GCrypto</strong> → Select <strong>USDC (Solana)</strong> → Tap <strong>Receive</strong> → Copy your <strong>USDC (Solana)</strong> wallet address.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center">
                    2
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm">
                      On <strong>FineEarn</strong>, open the <strong>Withdraw page</strong> → Enter your withdrawal amount.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center">
                    3
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm">
                      Paste the <strong>GCrypto USDC (Solana)</strong> address you copied earlier → Confirm and submit your withdrawal request.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center">
                    4
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm">
                      Once processed, you'll receive <strong>USDC</strong> in your <strong>GCrypto wallet</strong>.
                    </p>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center">
                    5
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm">
                      To convert to PHP, go to <strong>GCrypto</strong> → Tap <strong>Sell USDC</strong> → Choose <strong>GCash Balance</strong>.
                    </p>
                  </div>
                </div>

                {/* Success Message */}
                <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-blue-800 dark:text-blue-200 font-medium text-sm">
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
