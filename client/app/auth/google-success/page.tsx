"use client";

import { useEffect, useState } from "react";
import { sSet } from "@/utils/secureStorage";

const MOODIES_LOGO = "/images/moodies.png";

export default function GoogleSuccessPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");

    if (!token) {
      setStatus("error");
      setTimeout(() => {
        window.location.href = "/auth/login";
      }, 2000);
      return;
    }

    // Store the token
    sSet("authToken", token);
    const expiryMs = Date.now() + 1 * 24 * 60 * 60 * 1000;
    sSet("authTokenExpiry", String(expiryMs));

    // Fetch user data
    const fetchUser = async () => {
      try {
        const API_BASE =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const userData = await res.json();
          sSet("authUser", JSON.stringify(userData));
          sSet("user", JSON.stringify(userData));
          setStatus("success");
        } else {
          throw new Error("Failed to fetch user data");
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        setStatus("success"); // Still proceed since token is valid
      }

      // Redirect after short delay
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    };

    fetchUser();
  }, []);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Google-style Card */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-12">
          {/* Logo Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="mb-6">
              <svg
                viewBox="0 0 75 24"
                width="75"
                height="24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <g fillRule="evenodd">
                  <path
                    fill="#4285F4"
                    d="M67.954 16.303c-1.634 0-2.823-1.021-2.823-2.657 0-1.638 1.189-2.664 2.823-2.664.987 0 1.796.365 2.373 1.014l-.777.777c-.365-.403-.869-.641-1.596-.641-.957 0-1.782.795-1.782 1.858 0 1.064.825 1.859 1.782 1.859.644 0 1.048-.25 1.284-.594.204-.285.282-.645.289-1.037h-1.573v-.964h2.53c.013.118.02.266.02.42 0 .747-.2 1.667-.733 2.283-.521.608-1.185.937-2.192.937zm-7.98-.455h-.964c-.588 0-1.077-.015-1.077-.906V7.998h1.042v5.712c0 .39.144.558.484.558h.515v1.58zm3.753-.348c-.588 0-1.077-.016-1.077-.906V7.998h1.042v5.712c0 .39.144.558.484.558h.515v1.58h-.964zm-2.465-6.212c-.365 0-.667-.302-.667-.668 0-.354.302-.667.667-.667.35 0 .668.313.668.667 0 .366-.317.668-.668.668zm7.404 1.048c-1.93 0-3.5 1.554-3.5 3.473 0 1.93 1.57 3.484 3.5 3.484s3.5-1.554 3.5-3.484c0-1.92-1.57-3.473-3.5-3.473zm0 5.568c-1.15 0-2.083-.918-2.083-2.095 0-1.163.933-2.08 2.083-2.08 1.139 0 2.072.917 2.072 2.08 0 1.177-.933 2.095-2.072 2.095zM58.645 10.336c-1.93 0-3.5 1.554-3.5 3.473 0 1.93 1.57 3.484 3.5 3.484s3.5-1.554 3.5-3.484c0-1.92-1.57-3.473-3.5-3.473zm0 5.568c-1.15 0-2.083-.918-2.083-2.095 0-1.163.933-2.08 2.083-2.08 1.139 0 2.072.917 2.072 2.08 0 1.177-.933 2.095-2.072 2.095zm-11.09.455c-1.93 0-3.5-1.554-3.5-3.484 0-1.92 1.57-3.473 3.5-3.473 1.064 0 1.863.417 2.44 1.01l-.777.777c-.458-.444-.987-.668-1.663-.668-1.177 0-2.095.932-2.095 2.095 0 1.163.918 2.095 2.095 2.095.77 0 1.23-.326 1.534-.63.236-.236.365-.59.407-.918h-1.94v-1.042h2.925c.013.118.02.237.02.362 0 .928-.25 2.072-1.05 2.872-.79.807-1.795 1.004-2.896 1.004zm-5.712-5.18v1.042h2.925v.964h-2.925v2.095h3.343v1.042h-4.385V9.18h4.385v1.042h-3.343z"
                  />
                  <path
                    fill="#EA4335"
                    d="M10.496 8.403c0-.545-.05-.955-.144-1.38H5.34v2.465h2.93c-.065.574-.417 1.442-1.203 2.023l-.01.07 1.744 1.351.12.012c1.113-1.029 1.755-2.539 1.755-4.328"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.34 13.72c1.598 0 2.938-.525 3.918-1.428l-1.854-1.433c-.495.34-1.163.577-2.064.577-1.572 0-2.905-1.022-3.38-2.437l-.07.006-1.814 1.403-.024.066c.973 1.933 2.97 3.246 5.288 3.246"
                  />
                  <path
                    fill="#34A853"
                    d="M1.96 8.999c-.118-.34-.187-.705-.187-1.086 0-.38.07-.746.18-1.086l-.003-.074L.122 5.33l-.06.03C.026 5.715 0 6.082 0 6.456c0 .68.144 1.324.416 1.902l1.544-1.359z"
                  />
                  <path
                    fill="#4285F4"
                    d="M5.34 3.39c1.113 0 1.863.48 2.291.882l1.663-1.624C8.272 1.71 6.932 1 5.34 1 3.022 1 1.025 2.313.062 4.246l1.544 1.36C2.082 4.412 3.415 3.39 5.34 3.39"
                  />
                </g>
              </svg>
            </div>

            {/* Moodies Logo */}
            <div className="w-24 h-24 rounded-full bg-white border-4 border-gray-100 shadow-md flex items-center justify-center mb-4">
              <img
                src={MOODIES_LOGO}
                alt="Moodies"
                className="w-16 h-16 object-contain"
              />
            </div>
          </div>

          {/* Content */}
          <div className="text-center">
            {status === "loading" && (
              <>
                <div className="flex justify-center mb-6">
                  <div className="relative w-16 h-16">
                    {/* Google-style spinner */}
                    <svg
                      className="animate-spin w-16 h-16"
                      viewBox="0 0 66 66"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle
                        className="opacity-25"
                        cx="33"
                        cy="33"
                        r="30"
                        stroke="#E0E0E0"
                        strokeWidth="6"
                        fill="none"
                      />
                      <circle
                        cx="33"
                        cy="33"
                        r="30"
                        stroke="#4285F4"
                        strokeWidth="6"
                        fill="none"
                        strokeDasharray="90 150"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
                <h1 className="text-2xl text-gray-800 font-normal mb-3">
                  Signing you in
                </h1>
                <p className="text-sm text-gray-600">Please wait a moment...</p>
              </>
            )}

            {status === "success" && (
              <>
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
                    <svg
                      className="w-10 h-10 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>
                <h1 className="text-2xl text-gray-800 font-normal mb-3">
                  Success!
                </h1>
                <p className="text-sm text-gray-600">
                  You're being redirected to Moodies
                </p>
              </>
            )}

            {status === "error" && (
              <>
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center">
                    <svg
                      className="w-10 h-10 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </div>
                </div>
                <h1 className="text-2xl text-gray-800 font-normal mb-3">
                  Authentication failed
                </h1>
                <p className="text-sm text-gray-600">
                  Redirecting you back to sign in...
                </p>
              </>
            )}
          </div>
        </div>

        {/* Footer Links - Google style */}
        <div className="mt-6 text-center">
          <div className="flex justify-center space-x-6 text-xs text-gray-600">
            <a href="#" className="hover:text-gray-800">
              Help
            </a>
            <a href="#" className="hover:text-gray-800">
              Privacy
            </a>
            <a href="#" className="hover:text-gray-800">
              Terms
            </a>
          </div>
        </div>

        {/* Language selector - Google style */}
        <div className="mt-4 flex justify-center">
          <button className="flex items-center text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100">
            <svg
              className="w-4 h-4 mr-1"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M7 2a1 1 0 011 1v1h3a1 1 0 110 2H9.578a18.87 18.87 0 01-1.724 4.78c.29.354.596.696.914 1.026a1 1 0 11-1.44 1.389c-.188-.196-.373-.396-.554-.6a19.098 19.098 0 01-3.107 3.567 1 1 0 01-1.334-1.49 17.087 17.087 0 003.13-3.733 18.992 18.992 0 01-1.487-2.494 1 1 0 111.79-.89c.234.47.489.928.764 1.372.417-.934.752-1.913.997-2.927H3a1 1 0 110-2h3V3a1 1 0 011-1zm6 6a1 1 0 01.894.553l2.991 5.982a.869.869 0 01.02.037l.99 1.98a1 1 0 11-1.79.895L15.383 16h-4.764l-.724 1.447a1 1 0 11-1.788-.894l.99-1.98.019-.038 2.99-5.982A1 1 0 0113 8zm-1.382 6h2.764L13 11.236 11.618 14z"
                clipRule="evenodd"
              />
            </svg>
            English (United States)
          </button>
        </div>
      </div>
    </div>
  );
}
