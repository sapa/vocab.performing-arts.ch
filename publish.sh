export WEBSITE_FOLDER="dist"

rm -rf .cache
npx @11ty/eleventy

# ssh -i "/home/thomas/sparna/50-Informatique/serveurs/amazon-aws/sparna-keypair-francfort.pem" sapa@86.119.48.241
ssh -i "/home/thomas/sparna/50-Informatique/serveurs/amazon-aws/sparna-keypair-francfort.pem" -t sapa@86.119.48.241 'rm -rf vocab.performing-arts.ch && mkdir vocab.performing-arts.ch'

rsync -e "ssh -i \"/home/thomas/sparna/50-Informatique/serveurs/amazon-aws/sparna-keypair-francfort.pem\"" -a $WEBSITE_FOLDER/* sapa@86.119.48.241:vocab.performing-arts.ch

# note that the rm command will omit .htaccess, it will be kept
ssh -i "/home/thomas/sparna/50-Informatique/serveurs/amazon-aws/sparna-keypair-francfort.pem" -t sapa@86.119.48.241 'sudo su -c "\
rm -rf /opt/sapa/documentation/html/vocab.performing-arts.ch/*
cp -r vocab.performing-arts.ch/* /opt/sapa/documentation/html/vocab.performing-arts.ch"'