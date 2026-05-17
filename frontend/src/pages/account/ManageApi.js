import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import { toast } from "react-toastify";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Collapse from "@mui/material/Collapse";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import BreadcrumbsActiveLast from "../../components/Navigation/Breadcrumbs/BreadcrumbsActiveLast";

const ApiManagement = () => {
  const { user } = useSelector((state) => state.auth);
  const [keys, setKeys] = useState([]);
  const [permissionsConfig, setPermissionsConfig] = useState({});
  const [newKeyName, setNewKeyName] = useState("");
  const [selectedEndpoints, setSelectedEndpoints] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState(
    Object.fromEntries(
      Object.keys(permissionsConfig).map((cat) => [cat, true]),
    ),
  );
  const [generatedKey, setGeneratedKey] = useState(null);
  const [loading, setLoading] = useState(false);

  const config = {
    headers: { Authorization: `Bearer ${user.token}` },
  };

  const fetchKeys = async () => {
    try {
      const res = await axios.get("/api/manage-api-keys", config);
      setKeys(res.data);
    } catch {
      toast.error("Failed to load API keys.");
    }
  };

  const fetchPermissions = async () => {
    try {
      const res = await axios.get("/api/manage-api-keys/permissions", config);
      setPermissionsConfig(res.data);
    } catch {
      toast.error("Failed to load permissions.");
    }
  };

  useEffect(() => {
    fetchKeys();
    fetchPermissions();
  }, []);

  const toggleCategory = (category) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const isCategoryChecked = (category) => {
    const endpoints = permissionsConfig[category] || [];
    return endpoints.every((ep) => selectedEndpoints.includes(ep));
  };

  const isCategoryIndeterminate = (category) => {
    const endpoints = permissionsConfig[category] || [];
    const selected = endpoints.filter((ep) => selectedEndpoints.includes(ep));
    return selected.length > 0 && selected.length < endpoints.length;
  };

  const toggleCategoryAll = (category) => {
    const endpoints = permissionsConfig[category] || [];
    if (isCategoryChecked(category)) {
      setSelectedEndpoints((prev) =>
        prev.filter((ep) => !endpoints.includes(ep)),
      );
    } else {
      setSelectedEndpoints((prev) => [
        ...prev,
        ...endpoints.filter((ep) => !prev.includes(ep)),
      ]);
    }
  };

  const toggleEndpoint = (endpoint) => {
    setSelectedEndpoints((prev) =>
      prev.includes(endpoint)
        ? prev.filter((ep) => ep !== endpoint)
        : [...prev, endpoint],
    );
  };

  const handleGenerate = async () => {
    if (!newKeyName.trim()) {
      toast.error("Please enter a name for the key.");
      return;
    }
    if (selectedEndpoints.length === 0) {
      toast.error("Please select at least one permission.");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(
        "/api/manage-api-keys",
        { name: newKeyName.trim(), permissions: selectedEndpoints },
        config,
      );
      setGeneratedKey(res.data.plainKey);
      setNewKeyName("");
      setSelectedEndpoints([]);
      fetchKeys();
      toast.success("API key generated.");
    } catch {
      toast.error("Failed to generate key.");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id) => {
    try {
      await axios.delete(`/api/manage-api-keys/${id}`, config);
      setKeys((prev) => prev.filter((k) => k._id !== id));
      toast.success("API key revoked.");
    } catch {
      toast.error("Failed to revoke key.");
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard.");
  };

  return (
    <Container maxWidth="md">
      <BreadcrumbsActiveLast
        links={[
          { heading: "Settings", link: "/dashboard/settings" },
          { heading: "Manage API", link: "" },
        ]}
      />

      <Typography variant="h5" gutterBottom>
        API Key Management
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Generate API keys to access Micromax data programmatically. Each key is
        only shown once, so store it securely. External consumers pass the key as
        an <code>x-api-key</code> header to{" "}
        <code>/public/api/&#123;endpoint&#125;</code>.
      </Typography>

      {/* Generate new key */}
      <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
        <Typography variant="subtitle1" gutterBottom>
          Generate a new key
        </Typography>

        <TextField
          label="Key name"
          size="small"
          fullWidth
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          sx={{ mb: 3 }}
        />

        <Typography variant="subtitle2" gutterBottom>
          Permissions
        </Typography>

        {Object.entries(permissionsConfig).map(([category, endpoints]) => (
          <Box key={category} sx={{ mb: 1 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                py: 0.5,
              }}
              onClick={() => toggleCategory(category)}
            >
              {expandedCategories[category] && (
                <Checkbox
                  size="small"
                  checked={endpoints.every((ep) =>
                    selectedEndpoints.includes(ep),
                  )}
                  indeterminate={
                    endpoints.some((ep) => selectedEndpoints.includes(ep)) &&
                    !endpoints.every((ep) => selectedEndpoints.includes(ep))
                  }
                  onChange={(e) => {
                    e.stopPropagation();
                    if (
                      endpoints.every((ep) => selectedEndpoints.includes(ep))
                    ) {
                      setSelectedEndpoints((prev) =>
                        prev.filter((ep) => !endpoints.includes(ep)),
                      );
                    } else {
                      setSelectedEndpoints((prev) => [
                        ...prev,
                        ...endpoints.filter((ep) => !prev.includes(ep)),
                      ]);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
                {category}
              </Typography>
              <IconButton size="small">
                {expandedCategories[category] ? (
                  <ExpandLessIcon fontSize="small" />
                ) : (
                  <ExpandMoreIcon fontSize="small" />
                )}
              </IconButton>
            </Box>

            <Collapse in={!!expandedCategories[category]}>
              <Box sx={{ pl: 2 }}>
                {endpoints.map((ep) => (
                  <FormControlLabel
                    key={ep}
                    label={
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: "monospace" }}
                      >
                        {ep}
                      </Typography>
                    }
                    control={
                      <Checkbox
                        size="small"
                        checked={selectedEndpoints.includes(ep)}
                        onChange={() => toggleEndpoint(ep)}
                      />
                    }
                  />
                ))}
              </Box>
            </Collapse>
          </Box>
        ))}

        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={loading}
          sx={{ mt: 2 }}
        >
          Generate Key
        </Button>

        {generatedKey && (
          <Box
            sx={{
              mt: 2,
              p: 2,
              bgcolor: "#f0fdf4",
              border: "1px solid #86efac",
              borderRadius: 1,
            }}
          >
            <Typography variant="body2" color="success.dark" sx={{ mb: 1 }}>
              Copy this key now, as it won't be shown again.
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography
                variant="body2"
                sx={{ fontFamily: "monospace", wordBreak: "break-all" }}
              >
                {generatedKey}
              </Typography>
              <Tooltip title="Copy">
                <IconButton
                  size="small"
                  onClick={() => handleCopy(generatedKey)}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Existing keys */}
      <Typography variant="subtitle1" gutterBottom>
        Active keys
      </Typography>

      {keys.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No API keys yet.
        </Typography>
      ) : (
        keys.map((key) => (
          <Paper key={key._id} elevation={1} sx={{ p: 2, mb: 1 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography variant="body1" fontWeight={500}>
                  {key.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Prefix: <code>{key.keyPrefix}...</code> · Created:{" "}
                  {new Date(key.createdAt).toLocaleDateString("en-AU")}
                  {key.lastUsed &&
                    ` · Last used: ${new Date(key.lastUsed).toLocaleDateString("en-AU")}`}
                </Typography>
              </Box>
              <Tooltip title="Revoke">
                <IconButton
                  color="error"
                  size="small"
                  onClick={() => handleRevoke(key._id)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            {key.permissions && key.permissions.length > 0 && (
              <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {key.permissions.map((ep) => (
                  <Box
                    key={ep}
                    sx={{
                      px: 1,
                      py: 0.25,
                      bgcolor: "#eff6ff",
                      border: "1px solid #bfdbfe",
                      borderRadius: 1,
                      fontSize: "0.7rem",
                      fontFamily: "monospace",
                      color: "#1d4ed8",
                    }}
                  >
                    {ep}
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        ))
      )}
    </Container>
  );
};

export default ApiManagement;
