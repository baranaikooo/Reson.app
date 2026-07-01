# build_apk.ps1
Write-Host "Instalacia Capacitor zavislosti..."
npm install @capacitor/core @capacitor/android
npm install -D @capacitor/cli

Write-Host "Vytvaram public adresar (potrebny pre Capacitor aj ked pouzivame Remote URL)..."
mkdir -p public
echo "Reson" > public/index.html

Write-Host "Pridavam platformu Android..."
npx cap add android

Write-Host "Kopirujem nastavenia..."
npx cap sync android

Write-Host "Spustam Gradle build pre vygenerovanie APK..."
cd android
./gradlew assembleDebug
cd ..

Write-Host "Hotovo! APK najdes v zlozke: android/app/build/outputs/apk/debug/app-debug.apk"
