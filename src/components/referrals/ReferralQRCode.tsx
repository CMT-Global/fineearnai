import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, QrCode } from "lucide-react";

interface ReferralQRCodeProps {
  referralUrl: string;
  username: string;
}

export const ReferralQRCode = ({ referralUrl, username }: ReferralQRCodeProps) => {
  const [showModal, setShowModal] = useState(false);

  const downloadQRCode = () => {
    const svg = document.getElementById("referral-qr-code");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    canvas.width = 512;
    canvas.height = 512;

    img.onload = () => {
      ctx?.drawImage(img, 0, 0, 512, 512);
      const pngFile = canvas.toDataURL("image/png");
      
      const downloadLink = document.createElement("a");
      downloadLink.download = `${username}-referral-qr.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setShowModal(true)}
        className="gap-2"
      >
        <QrCode className="h-4 w-4" />
        QR Code
      </Button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Referral QR Code</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-white p-4 rounded-lg">
              <QRCodeSVG
                id="referral-qr-code"
                value={referralUrl}
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>
            
            <p className="text-sm text-muted-foreground text-center">
              Share this QR code for easy referral sign-ups
            </p>
            
            <Button
              onClick={downloadQRCode}
              className="gap-2 w-full"
            >
              <Download className="h-4 w-4" />
              Download QR Code
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
